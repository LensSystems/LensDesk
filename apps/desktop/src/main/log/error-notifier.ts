// Limita los avisos al shell por errores no capturados: como máximo uno por intervalo, para que
// una cascada de fallos no inunde la pantalla. El aviso nunca lleva mensaje ni pila.
export type ProcessErrorKind = "uncaught" | "rejection";

export function createErrorNotifier(options: {
  now(): number;
  minIntervalMs: number;
  emit(payload: { kind: ProcessErrorKind }): void;
}): (kind: ProcessErrorKind) => void {
  let lastAt: number | undefined;
  return (kind) => {
    const now = options.now();
    if (lastAt !== undefined && now - lastAt < options.minIntervalMs) return;
    lastAt = now;
    options.emit({ kind });
  };
}
