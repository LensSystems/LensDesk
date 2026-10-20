import { applyDocumentContext } from "@lensdesk/ui";

export type RendererContext = {
  locale: "es" | "en";
  theme: "dark" | "light";
  accent?: "blue" | "green";
};

export function applyContext(context: RendererContext, root: HTMLElement): void {
  applyDocumentContext(context, root);
}
