export function spellcheckEnabled(platform: string): boolean {
  return platform === "darwin";
}

interface SpellcheckSession {
  setSpellCheckerEnabled(enabled: boolean): void;
  setSpellCheckerLanguages(languages: string[]): void;
}

export function applySpellcheckPolicy(session: SpellcheckSession, platform: string): void {
  if (spellcheckEnabled(platform)) return;
  session.setSpellCheckerEnabled(false);
  try {
    session.setSpellCheckerLanguages([]);
  } catch {}
}
