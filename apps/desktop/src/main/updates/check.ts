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
    if (semver.gt(version, options.currentVersion))
      return { kind: "available", version, url: release.data.html_url };
    return { kind: "none" };
  } catch (error) {
    options.log?.(
      `Falló la consulta de versiones: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { kind: "error" };
  }
}
