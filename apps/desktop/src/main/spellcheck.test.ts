import { expect, it, vi } from "vitest";
import { applySpellcheckPolicy, spellcheckEnabled } from "./spellcheck.ts";

it.each(["win32", "linux", "unknown"])("desactiva y vacía idiomas en %s", (platform) => {
  const session = { setSpellCheckerEnabled: vi.fn(), setSpellCheckerLanguages: vi.fn() };
  expect(spellcheckEnabled(platform)).toBe(false);
  applySpellcheckPolicy(session, platform);
  expect(session.setSpellCheckerEnabled).toHaveBeenCalledWith(false);
  expect(session.setSpellCheckerLanguages).toHaveBeenCalledWith([]);
});
it("conserva el corrector nativo de macOS", () => {
  const session = { setSpellCheckerEnabled: vi.fn(), setSpellCheckerLanguages: vi.fn() };
  expect(spellcheckEnabled("darwin")).toBe(true);
  applySpellcheckPolicy(session, "darwin");
  expect(session.setSpellCheckerEnabled).not.toHaveBeenCalled();
  expect(session.setSpellCheckerLanguages).not.toHaveBeenCalled();
});
it("tolera plataformas sin idiomas configurables", () => {
  const session = {
    setSpellCheckerEnabled: vi.fn(),
    setSpellCheckerLanguages: () => {
      throw new Error("unsupported");
    },
  };
  expect(() => applySpellcheckPolicy(session, "linux")).not.toThrow();
  expect(session.setSpellCheckerEnabled).toHaveBeenCalledWith(false);
});
