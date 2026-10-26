import semver from "semver";
import { z } from "zod";
import type { UpdateCheckResult } from "../../shared/host-channels.ts";

export type { UpdateCheckResult };
export type UpdateFetch = (
  url: string,
  init: { method: "GET"; headers: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REPO_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const releaseSchema = z.object({
  tag_name: z.string().min(1),
  assets: z.array(z.object({ name: z.string(), browser_download_url: z.string() })).optional(),
  html_url: z
    .string()
    .url()
    .refine((url) => new URL(url).protocol === "https:"),
});

export function releasesUrl(repo: string): string {
  return `https://api.github.com/repos/${repo}/releases/latest`;
}

// Única petición de red de la app. Sin repositorio, desactivada o con una comprobación hace menos
// de 24 h no llama a `fetch`. Cualquier fallo se registra y se devuelve como error.
export async function checkForUpdate(options: {
  repo: string;
  platform?: string;
  arch?: string;
  installedTools?: () => { id: string; version: string }[];
  enabled: boolean;
  lastCheckedAt: string | null;
  now: () => Date;
  currentVersion: string;
  fetch: UpdateFetch;
  log?: (message: string) => void;
  timeoutMs?: number;
}): Promise<UpdateCheckResult> {
  if (options.repo === "" || !options.enabled) return { kind: "skipped" };
  if (!REPO_PATTERN.test(options.repo)) {
    options.log?.("El repositorio de versiones no tiene la forma <owner>/<repo>.");
    return { kind: "skipped" };
  }
  if (options.lastCheckedAt !== null) {
    const last = Date.parse(options.lastCheckedAt);
    if (Number.isFinite(last) && options.now().getTime() - last < CHECK_INTERVAL_MS)
      return { kind: "skipped" };
  }
  try {
    const response = await options.fetch(releasesUrl(options.repo), {
      method: "GET",
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });
    if (!response.ok) {
      options.log?.(`La consulta de versiones respondió ${response.status}.`);
      return { kind: "error" };
    }
    const release = releaseSchema.safeParse(await response.json());
    if (!release.success) {
      options.log?.("La respuesta de versiones no tiene tag_name y html_url válidos.");
      return { kind: "error" };
    }
    const version = semver.valid(release.data.tag_name.replace(/^v/, ""));
    if (!version) {
      options.log?.(`La etiqueta ${release.data.tag_name.slice(0, 64)} no es semver.`);
      return { kind: "error" };
    }
    const assets = (release.data.assets ?? []).filter((asset) => {
      try {
        const url = new URL(asset.browser_download_url);
        return (
          url.origin === "https://github.com" &&
          !url.username &&
          !url.password &&
          url.pathname.startsWith(`/${options.repo}/releases/download/`)
        );
      } catch {
        return false;
      }
    });
    const tools = detectToolUpdates(assets, options.installedTools?.() ?? []);
    const extra = tools.length ? { tools } : {};
    if (semver.gt(version, options.currentVersion)) {
      const installer = pickInstallerAsset(
        assets,
        options.platform ?? "",
        options.arch ?? "",
        version,
      );
      return {
        kind: "available",
        version,
        url: release.data.html_url,
        ...(installer ? { installerUrl: installer.browser_download_url } : {}),
        ...extra,
      };
    }
    return { kind: "none", ...extra };
  } catch (error) {
    options.log?.(
      `Falló la consulta de versiones: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { kind: "error" };
  }
}

export type ReleaseAsset = { name: string; browser_download_url: string };

export function pickInstallerAsset(
  assets: ReleaseAsset[],
  platform: string,
  arch: string,
  version: string,
): ReleaseAsset | undefined {
  const suffix =
    platform === "darwin" && ["arm64", "x64"].includes(arch)
      ? `mac-${arch}.dmg`
      : platform === "win32" && arch === "x64"
        ? "win-x64.exe"
        : undefined;
  return suffix ? assets.find(({ name }) => name === `LensDesk-${version}-${suffix}`) : undefined;
}

function detectToolUpdates(assets: ReleaseAsset[], installed: { id: string; version: string }[]) {
  const updates = new Map<string, { id: string; version: string; url: string }>();
  for (const asset of assets) {
    const match = /^([a-z][a-z0-9-]{1,39})-(\d+\.\d+\.\d+)\.lenspkg$/.exec(asset.name);
    if (!match) continue;
    const id = match[1];
    const version = match[2];
    if (!id || !version) continue;
    const tool = installed.find((tool) => tool.id === id);
    if (
      !tool ||
      !semver.valid(version) ||
      !semver.valid(tool.version) ||
      !semver.gt(version, tool.version)
    )
      continue;
    const previous = updates.get(id);
    if (!previous || semver.gt(version, previous.version))
      updates.set(id, { id, version, url: asset.browser_download_url });
  }
  return [...updates.values()];
}
