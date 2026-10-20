export type DocumentContext = {
  theme: string;
  locale: string;
  accent?: "blue" | "green";
};

export function applyDocumentContext(
  context: DocumentContext,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.theme = context.theme;
  root.lang = context.locale;
  if (context.accent === "green") root.dataset.accent = context.accent;
  else root.removeAttribute("data-accent");
}
