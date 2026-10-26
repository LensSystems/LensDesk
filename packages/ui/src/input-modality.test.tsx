import { afterEach, expect, it, vi } from "vitest";
import { keyboardFocus, trackInputModality } from "./input-modality.ts";

afterEach(() => {
  document.documentElement.removeAttribute("data-modalidad");
  vi.restoreAllMocks();
});

it("captura el puntero antes del destino y cualquier tecla restaura el teclado", () => {
  const stop = trackInputModality();
  const target = document.createElement("span");
  document.body.append(target);
  target.addEventListener("pointerdown", (event) => {
    expect(document.documentElement.dataset.modalidad).toBe("puntero");
    event.stopPropagation();
  });
  target.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  expect(document.documentElement.dataset.modalidad).not.toBe("puntero");
  stop();
  document.dispatchEvent(new Event("pointerdown"));
  expect(document.documentElement.dataset.modalidad).not.toBe("puntero");
  document.documentElement.dataset.modalidad = "puntero";
  document.dispatchEvent(new KeyboardEvent("keydown"));
  expect(document.documentElement.dataset.modalidad).toBe("puntero");
  target.remove();
});

it("distingue el foco de botones y campos de texto en el documento propietario", () => {
  const doc = document.implementation.createHTMLDocument();
  doc.documentElement.dataset.modalidad = "puntero";
  for (const tag of ["button", "input", "textarea", "select", "div"]) {
    const element = doc.createElement(tag);
    if (tag === "div") element.setAttribute("contenteditable", "true");
    vi.spyOn(element, "matches").mockImplementation((selector) =>
      selector === ":focus-visible" ? true : Element.prototype.matches.call(element, selector),
    );
    expect(keyboardFocus(element)).toBe(tag !== "button");
    doc.documentElement.dataset.modalidad = "teclado";
    expect(keyboardFocus(element)).toBe(true);
    doc.documentElement.dataset.modalidad = "puntero";
  }
  const button = doc.createElement("button");
  vi.spyOn(button, "matches").mockReturnValue(false);
  expect(keyboardFocus(button)).toBe(false);
});
