// Texto «Copiado» visible dentro del botón (no la copia que sale durante la transición).
export const copiedText = ":scope > span:not(.copia-saliente)";

const pending = new WeakMap<HTMLButtonElement, () => void>();

// Mide ambos estados con el contenido y el idioma actuales. El botón debe seguir montado tras
// el cambio (si React lo sustituye, no hay transición).
export function changeCopyState(button: HTMLButtonElement, change: () => void) {
  const start = button.getBoundingClientRect().width;
  pending.get(button)?.();
  const outgoing = document.createElement("span");
  outgoing.className = "copia-saliente";
  outgoing.setAttribute("aria-hidden", "true");
  for (const child of button.childNodes) outgoing.append(child.cloneNode(true));
  const previousClass = button.className;
  change();
  if (outgoing.innerHTML === button.innerHTML && previousClass === button.className) return;
  if (!window.matchMedia?.("(prefers-reduced-motion: no-preference)").matches) return;
  const end = button.getBoundingClientRect().width;
  const position = button.style.position;
  button.style.position = "relative";
  button.style.width = `${start}px`;
  // Primero el ancho de partida sin transición; si no, el navegador anima hacia él.
  void button.offsetWidth;
  button.dataset.copyMotion = "true";
  button.append(outgoing);
  void button.offsetWidth;
  button.style.width = `${end}px`;
  const finish = () => {
    clearTimeout(timer);
    outgoing.remove();
    button.style.removeProperty("width");
    button.style.position = position;
    delete button.dataset.copyMotion;
    button.removeEventListener("transitionend", ended);
    pending.delete(button);
  };
  const ended = (event: TransitionEvent) => {
    if (event.target === button && event.propertyName === "width") finish();
  };
  const timer = setTimeout(finish, 150);
  button.addEventListener("transitionend", ended);
  pending.set(button, finish);
}
