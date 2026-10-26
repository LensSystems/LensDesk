import { Button, Check, Copy, changeCopyState } from "@lensdesk/ui";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Example } from "./Example.tsx";

// Botón de copiar que se ensancha hasta «Copiado» y vuelve a los 2 s.
export function CopyExample() {
  const [copied, setCopied] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const update = (value: boolean) => {
    if (!button.current) return setCopied(value);
    changeCopyState(button.current, () => flushSync(() => setCopied(value)));
  };
  return (
    <Example names={["changeCopyState"]}>
      <Button
        ref={button}
        variant="ghost"
        aria-label={copied ? "Copiado" : "Copiar"}
        onClick={() => {
          update(true);
          setTimeout(() => update(false), 2000);
        }}
      >
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        {copied && <span>Copiado</span>}
      </Button>
    </Example>
  );
}
