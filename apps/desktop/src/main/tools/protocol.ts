import { realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { protocol, session } from "electron";

import { applySpellcheckPolicy } from "../spellcheck.ts";

export const TOOL_CSP =
  "default-src 'self' lenstool:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'; form-action 'none'";

export type ProtocolTool = { id: string; installPath: string; enabled: boolean };
type FileSystem = {
  realpath: (path: string) => Promise<string>;
  stat: (path: string) => Promise<{ isFile(): boolean }>;
};

export async function resolveToolFile(options: {
  url: string;
  registry: { get(id: string): ProtocolTool | undefined };
  // La sesión de una herramienta solo puede servir sus propios archivos.
  ownerToolId?: string;
  fs?: FileSystem;
}): Promise<string | null> {
  try {
    const raw = /^lenstool:\/\/([^/?#]+)([^?#]*)/i.exec(options.url);
    if (!raw) return null;
    const url = new URL(options.url);
    if (
      url.protocol !== "lenstool:" ||
      raw[1] !== url.hostname ||
      !/^[a-z][a-z0-9-]{1,39}$/.test(url.hostname)
    )
      return null;
    if (options.ownerToolId !== undefined && url.hostname !== options.ownerToolId) return null;
    const tool = options.registry.get(url.hostname);
    if (!tool || tool.id !== url.hostname || !tool.enabled) return null;
    const rawPath = raw[2] || "/";
    if (rawPath.startsWith("//")) return null;
    const decoded = decodeURIComponent(rawPath);
    if (decoded.includes("\0") || decoded.includes("\\")) return null;
    const parts = decoded.split("/").filter(Boolean);
    if (parts.some((part) => part === "." || part === "..")) return null;
    const uiRoot = resolve(tool.installPath, "ui");
    const requested = resolve(uiRoot, ...(parts.length ? parts : ["index.html"]));
    const rel = relative(uiRoot, requested);
    if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
    const fs = options.fs ?? { realpath, stat };
    const [realRoot, realFile] = await Promise.all([fs.realpath(uiRoot), fs.realpath(requested)]);
    const realRel = relative(realRoot, realFile);
    if (realRel === ".." || realRel.startsWith(`..${sep}`) || isAbsolute(realRel)) return null;
    if (!(await fs.stat(realFile)).isFile()) return null;
    return realFile;
  } catch {
    return null;
  }
}

export function toolResponseHeaders(filePath?: string): Record<string, string> {
  const contentTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ico": "image/x-icon",
    ".avif": "image/avif",
    ".wasm": "application/wasm",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".pdf": "application/pdf",
  };
  return {
    "Content-Security-Policy": TOOL_CSP,
    "Content-Type":
      contentTypes[extname(filePath ?? "").toLowerCase()] ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  };
}

const registeredPartitions = new Set<string>();
protocol.registerSchemesAsPrivileged([
  {
    scheme: "lenstool",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

export function registerToolProtocol(registry: {
  get(id: string): ProtocolTool | undefined;
}): void {
  const ids = (registry as { list?: () => ProtocolTool[] }).list?.().map((tool) => tool.id) ?? [];
  for (const id of ids) registerToolProtocolFor(id, registry);
}

export function registerToolProtocolFor(
  toolId: string,
  registry: { get(id: string): ProtocolTool | undefined },
): void {
  if (!/^[a-z][a-z0-9-]{1,39}$/.test(toolId)) return;
  const partition = `persist:tool-${toolId}`;
  if (registeredPartitions.has(partition)) return;
  registeredPartitions.add(partition);
  const toolSession = session.fromPartition(partition);
  applySpellcheckPolicy(toolSession, process.platform);
  toolSession.protocol.handle("lenstool", async (request) => {
    const file = await resolveToolFile({ url: request.url, registry, ownerToolId: toolId });
    if (!file) return new Response("Not Found", { status: 404, headers: toolResponseHeaders() });
    const body = await (await import("node:fs/promises")).readFile(file);
    return new Response(body, { headers: toolResponseHeaders(file) });
  });
  toolSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  toolSession.setPermissionCheckHandler(() => false);
  toolSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !details.url.startsWith("lenstool:") });
  });
}
