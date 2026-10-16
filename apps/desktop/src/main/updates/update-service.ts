import { checkForUpdate, type UpdateCheckResult, type UpdateFetch } from "./check.ts";

// Une la comprobación con los ajustes: lee `updates.check` y `updates.lastCheckedAt`, guarda la
// hora cuando hubo consulta y avisa al shell con `update.available` si hay una versión mayor.
export function createUpdateService(options: {
  repo: string;
  currentVersion: string;
  fetch: UpdateFetch;
  now: () => Date;
  settings: {
    enabled(): boolean;
    lastCheckedAt(): string | null;
    setLastCheckedAt(value: string): void;
  };
  emit(payload: { version: string; html_url: string }): void;
  log(message: string): void;
}) {
  return {
    // `force` ignora el intervalo de 24 h (botón "Comprobar ahora"), nunca el repositorio vacío
    // ni el ajuste desactivado.
    async run(force = false): Promise<UpdateCheckResult> {
      const result = await checkForUpdate({
        repo: options.repo,
        enabled: options.settings.enabled(),
        lastCheckedAt: force ? null : options.settings.lastCheckedAt(),
        now: options.now,
        currentVersion: options.currentVersion,
        fetch: options.fetch,
        log: options.log,
      });
      if (result.kind === "skipped") return result;
      try {
        options.settings.setLastCheckedAt(options.now().toISOString());
      } catch (error) {
        options.log(
          `No se pudo guardar la hora de la comprobación: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (result.kind === "available")
        options.emit({ version: result.version, html_url: result.url });
      return result;
    },
  };
}
