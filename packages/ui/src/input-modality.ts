// El navegador a veces marca como foco de teclado el primer clic que da el foco a una vista.
// Se guarda en <html> si la última entrada fue del puntero para que el contorno solo salga con
// teclado; los campos de texto lo conservan siempre.
const textField =
  'input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"], [type="submit"], [type="reset"], [type="file"], [type="color"]), textarea, select, [contenteditable]:not([contenteditable="false"])';

export function trackInputModality(doc: Document = document): () => void {
  const root = doc.documentElement;
  const pointer = () => {
    root.dataset.modalidad = "puntero";
  };
  const keyboard = () => {
    root.dataset.modalidad = "teclado";
  };
  doc.addEventListener("pointerdown", pointer, true);
  doc.addEventListener("keydown", keyboard, true);
  return () => {
    doc.removeEventListener("pointerdown", pointer, true);
    doc.removeEventListener("keydown", keyboard, true);
  };
}

export function keyboardFocus(element: Element): boolean {
  if (!element.matches(":focus-visible")) return false;
  if (element.matches(textField)) return true;
  return element.ownerDocument.documentElement.dataset.modalidad !== "puntero";
}
