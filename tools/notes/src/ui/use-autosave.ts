import { useCallback, useEffect, useRef } from "react";

export function useAutosave(
  id: string | null,
  body: string,
  save: (id: string, body: string) => void,
) {
  const latest = useRef({ id, body, save });
  const timer = useRef<number | undefined>(undefined);
  latest.current = { id, body, save };
  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const current = latest.current;
    if (current.id) current.save(current.id, current.body);
  }, []);

  // El cuerpo cambia por pulsación y debe reiniciar el temporizador.
  // biome-ignore lint/correctness/useExhaustiveDependencies: El cambio del cuerpo reinicia el debounce.
  useEffect(() => {
    if (!id) return;
    timer.current = window.setTimeout(flush, 800);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener("beforeunload", flush);
    };
  }, [id, body, flush]);

  return flush;
}
