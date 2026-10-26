import { useLayoutEffect, useRef, useState } from "react";

// Cuenta los intentos fallidos: el intento termina cuando `busy` vuelve a falso, aunque los
// intentos restantes se hayan actualizado antes, todavía ocupado.
export function useVaultFeedback(busy: boolean, error: string, failures = 0) {
  const pending = useRef(false);
  const initial = useRef(failures);
  const [failure, setFailure] = useState(0);
  useLayoutEffect(() => {
    if (busy) {
      if (!pending.current) {
        initial.current = failures;
        pending.current = true;
      }
      return;
    }
    if (!pending.current) return;
    pending.current = false;
    if (error || failures > initial.current) setFailure((value) => value + 1);
  }, [busy, error, failures]);
  return failure;
}
