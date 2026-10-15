export type RendererContext = { locale: "es" | "en"; theme: "dark" | "light" };

export function applyContext(context: RendererContext, root: HTMLElement): void {
  root.dataset.theme = context.theme;
  root.lang = context.locale;
}
