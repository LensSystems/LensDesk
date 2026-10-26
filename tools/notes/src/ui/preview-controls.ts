import { Check, Copy, changeCopyState, Eye, EyeOff, KeyRound } from "@lensdesk/ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

function icon(component: typeof Copy) {
  return renderToStaticMarkup(createElement(component, { size: 15, "aria-hidden": true }));
}
export const copyIcon = icon(Copy);
export const eyeIcon = icon(Eye);
export const eyeOffIcon = icon(EyeOff);
export const keyIcon = icon(KeyRound);
export const checkIcon = icon(Check);

export function confirmCopy(button: HTMLButtonElement, label: string) {
  changeCopyState(button, () => {
    button.replaceChildren();
    const icon = document.createElement("span");
    icon.innerHTML = checkIcon;
    const text = document.createElement("span");
    text.textContent = label;
    button.append(icon, text);
    button.classList.add("copy-confirmation");
    button.setAttribute("aria-label", label);
  });
}

export function resetCopy(button: HTMLButtonElement, label: string) {
  changeCopyState(button, () => {
    button.innerHTML = copyIcon;
    button.classList.remove("copy-confirmation");
    button.setAttribute("aria-label", label);
  });
}
