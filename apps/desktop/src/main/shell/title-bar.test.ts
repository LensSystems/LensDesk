import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { HEADER_HEIGHT } from "../../shared/layout.ts";
import { resolveTheme } from "../context.ts";
import { shellWindowOptions } from "../wire-app.ts";
import { titleBarColors, titleBarOverlayFor, updateTitleBar } from "./title-bar.ts";

describe("barra de título", () => {
  it("mantiene la altura y los colores sincronizados con CSS", () => {
    expect(HEADER_HEIGHT).toBe(52);
    const css = readFileSync(
      new URL("../../../../../packages/sdk/src/theme.css", import.meta.url),
      "utf8",
    );
    for (const theme of ["dark", "light"] as const) {
      const block = css.split(`[data-theme="${theme}"] {`)[1]?.split("}")[0];
      expect(block).toBeDefined();
      expect(block?.match(/--ld-bg:\s*(#[\da-f]+);/)?.[1]).toBe(titleBarColors[theme].color);
      expect(block?.match(/--ld-text:\s*(#[\da-f]+);/)?.[1]).toBe(
        titleBarColors[theme].symbolColor,
      );
      expect(titleBarOverlayFor(theme)).toEqual({ ...titleBarColors[theme], height: 52 });
    }
  });
  it.each(["darwin", "win32", "linux"])("opciones aisladas en %s", (platform) => {
    const options = shellWindowOptions({ width: 900 }, false, "host.cjs", platform, "light");
    expect(options).toMatchObject({
      width: 900,
      show: false,
      webPreferences: {
        preload: "host.cjs",
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    if (platform === "darwin")
      expect(options).toMatchObject({
        titleBarStyle: "hiddenInset",
        trafficLightPosition: { x: 16, y: 19 },
        backgroundColor: titleBarColors.light.color,
      });
    else if (platform === "win32")
      expect(options).toMatchObject({
        titleBarStyle: "hidden",
        titleBarOverlay: titleBarOverlayFor("light"),
        backgroundColor: titleBarColors.light.color,
      });
    else {
      expect(options).not.toHaveProperty("titleBarStyle");
      expect(options).not.toHaveProperty("backgroundColor");
    }
  });
  it.each(["darwin", "win32", "linux"])("actualiza con tema efectivo en %s", (platform) => {
    const window = { setBackgroundColor: vi.fn(), setTitleBarOverlay: vi.fn() };
    for (const [setting, systemDark] of [
      ["system", true],
      ["system", false],
      ["dark", false],
      ["light", true],
    ] as const) {
      const theme = resolveTheme(setting, systemDark);
      updateTitleBar(window, platform, theme);
      if (platform === "win32")
        expect(window.setTitleBarOverlay).toHaveBeenLastCalledWith(titleBarOverlayFor(theme));
      else expect(window.setTitleBarOverlay).not.toHaveBeenCalled();
      if (platform !== "linux")
        expect(window.setBackgroundColor).toHaveBeenLastCalledWith(titleBarColors[theme].color);
      else expect(window.setBackgroundColor).not.toHaveBeenCalled();
    }
  });
});
