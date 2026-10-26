import { Save } from "@lensdesk/ui";

// Dos disquetes superpuestos: el de atrás atenuado y desplazado arriba a la derecha.
export function SaveAllStack({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`relative size-[18px] shrink-0 ${className}`}>
      <Save size={13} className="absolute top-0 left-[5px] opacity-70" />
      <Save size={13} className="absolute top-[5px] left-0" />
    </span>
  );
}
