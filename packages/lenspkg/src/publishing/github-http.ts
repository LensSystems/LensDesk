import { OFFICIAL_TOOLS_REPOSITORY, TOOL_CATALOG_LIMITS } from "../catalog/contract.ts";
import { ToolReleaseError } from "./error.ts";

const API_ORIGIN = "https://api.github.com";
const API_ROOT = `/repos/${OFFICIAL_TOOLS_REPOSITORY}`;
const HTTP_TIMEOUT_MS = 120_000;
const API_BYTES = 2 * 1024 * 1024;
const ASSET_ORIGINS = new Set([
  "https://release-assets.githubusercontent.com",
  "https://objects.githubusercontent.com",
]);

async function boundedBytes(response: Response, limit: number): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel();
    throw new ToolReleaseError("GitHub response exceeds size limit");
  }
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new ToolReleaseError("GitHub response exceeds size limit");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export function createGitHubReleaseHttp(token: string, fetcher: typeof fetch = fetch) {
  if (!token) throw new ToolReleaseError("A workflow token is required");
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
  };
  async function send(url: string, init: RequestInit, authenticated: boolean): Promise<Response> {
    try {
      return await fetcher(url, {
        ...init,
        headers: authenticated ? { ...headers, ...init.headers } : init.headers,
        credentials: "omit",
        redirect: "manual",
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
    } catch {
      throw new ToolReleaseError("GitHub request failed");
    }
  }
  const apiUrl = (endpoint: string) => {
    const url = new URL(`${API_ORIGIN}${endpoint}`);
    if (
      !endpoint.startsWith(`${API_ROOT}/`) ||
      /[\\#%]/.test(endpoint) ||
      endpoint.includes("..") ||
      url.origin !== API_ORIGIN ||
      !url.pathname.startsWith(`${API_ROOT}/`)
    )
      throw new ToolReleaseError("Unexpected GitHub API endpoint");
    return url.href;
  };
  async function json(method: string, endpoint: string, body?: unknown): Promise<unknown> {
    const response = await send(
      apiUrl(endpoint),
      {
        method,
        ...(body === undefined
          ? {}
          : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
      },
      true,
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new ToolReleaseError(`GitHub API responded with ${response.status}`);
    }
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(await boundedBytes(response, API_BYTES)),
      );
    } catch {
      throw new ToolReleaseError("GitHub API returned invalid or excessive JSON");
    }
  }
  return {
    json,
    async downloadAsset(id: number, maximumBytes: number): Promise<Uint8Array> {
      if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        !Number.isSafeInteger(maximumBytes) ||
        maximumBytes > TOOL_CATALOG_LIMITS.packageBytes ||
        maximumBytes < 1
      )
        throw new ToolReleaseError("Invalid asset ID or size limit");
      let response = await send(
        apiUrl(`${API_ROOT}/releases/assets/${id}`),
        { method: "GET", headers: { Accept: "application/octet-stream" } },
        true,
      );
      if (response.status === 302) {
        const location = response.headers.get("location") ?? "";
        await response.body?.cancel();
        const url = new URL(location);
        if (
          location.length > 16_384 ||
          !ASSET_ORIGINS.has(url.origin) ||
          url.username ||
          url.password ||
          url.hash
        )
          throw new ToolReleaseError("Asset redirect is not an approved GitHub origin");
        response = await send(
          url.href,
          { method: "GET", headers: { Accept: "application/octet-stream" } },
          false,
        );
      }
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new ToolReleaseError("Could not download release asset");
      }
      return boundedBytes(response, maximumBytes);
    },
    async uploadAsset(releaseId: number, file: { name: string; bytes: Uint8Array }): Promise<void> {
      if (
        !Number.isSafeInteger(releaseId) ||
        releaseId <= 0 ||
        /^(?:[a-z][a-z0-9-]{1,39}-\d+\.\d+\.\d+\.lenspkg|tool-release\.json|SHA256SUMS\.txt)$/.exec(
          file.name,
        )?.[0] !== file.name ||
        file.bytes.length < 1 ||
        file.bytes.length > TOOL_CATALOG_LIMITS.packageBytes
      )
        throw new ToolReleaseError("Invalid release upload");
      const url = `https://uploads.github.com${API_ROOT}/releases/${releaseId}/assets?name=${encodeURIComponent(file.name)}`;
      const response = await send(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: new Uint8Array(file.bytes),
        },
        true,
      );
      await response.body?.cancel();
      if (response.status !== 201)
        throw new ToolReleaseError(`GitHub upload responded with ${response.status}`);
    },
  };
}
