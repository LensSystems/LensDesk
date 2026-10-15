import { beforeEach, describe, expect, it } from "vitest";
import { applyContext } from "./apply-context.ts";

describe("applyContext", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("lang");
  });

  it("applies theme and locale to the document root", () => {
    applyContext({ locale: "en", theme: "light" }, document.documentElement);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.lang).toBe("en");
  });

  it("updates the theme on a context event without reloading", () => {
    applyContext({ locale: "es", theme: "dark" }, document.documentElement);
    applyContext({ locale: "es", theme: "light" }, document.documentElement);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.lang).toBe("es");
  });
});
