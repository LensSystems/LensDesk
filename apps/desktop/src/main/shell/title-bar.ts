import { HEADER_HEIGHT } from "../../shared/layout.ts";
import type { ResolvedTheme } from "../context.ts";

// Única copia de hex fuera de theme.css; title-bar.test.ts comprueba los tokens.
export const titleBarColors = {
  dark: { color: "#2a2f36", symbolColor: "#eef1f4" },
  light: { color: "#e9ecf0", symbolColor: "#1c222a" },
} as const;

export function titleBarOverlayFor(theme: ResolvedTheme) {
  return { ...titleBarColors[theme], height: HEADER_HEIGHT };
}

export function updateTitleBar(
  window: {
    setBackgroundColor(color: string): void;
    setTitleBarOverlay(options: ReturnType<typeof titleBarOverlayFor>): void;
  },
  platform: string,
  theme: ResolvedTheme,
): void {
  if (platform !== "darwin" && platform !== "win32") return;
  window.setBackgroundColor(titleBarColors[theme].color);
  if (platform === "win32") window.setTitleBarOverlay(titleBarOverlayFor(theme));
}

export function wireFullScreen(window: {
  isFullScreen(): boolean;
  on(event: "enter-full-screen" | "leave-full-screen", listener: () => void): unknown;
  webContents: {
    on(event: "did-finish-load", listener: () => void): unknown;
    send(event: "window.fullScreenChanged", payload: { fullScreen: boolean }): void;
  };
}): void {
  const publish = () =>
    window.webContents.send("window.fullScreenChanged", { fullScreen: window.isFullScreen() });
  window.on("enter-full-screen", publish);
  window.on("leave-full-screen", publish);
  window.webContents.on("did-finish-load", publish);
}
