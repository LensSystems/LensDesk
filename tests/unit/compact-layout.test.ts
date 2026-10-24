import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const shell = (name: string) =>
  readFileSync(`apps/desktop/src/renderer/src/shell/${name}.tsx`, "utf8");
const converter = (name: string) => readFileSync(`tools/md-converter/src/ui/${name}`, "utf8");

it("mantiene las medidas compactas del marco y los encabezados", () => {
  expect(shell("PageFrame")).toContain("gap-4 min-[900px]:gap-7");
  expect(shell("PageFrame")).toContain("p-6 min-[900px]:px-12 min-[900px]:py-10");
  for (const page of ["ToolsPage", "SettingsPage"]) {
    expect(shell(page)).toContain("text-2xl leading-8");
  }
  expect(shell("ToolsPage")).not.toContain("space-y-1.5");
  expect(shell("ToolsPage")).toContain("items-center gap-4 min-[900px]:items-end");
  expect(shell("ToolsPage")).toContain("text-[13px] leading-[1.45]");
  expect(shell("ToolCard")).toContain("text-[13px] leading-5 text-muted");
  expect(shell("ToolCard")).not.toContain("space-y-1");
});

it("limita a Ajustes la eliminación de sombras y respeta sus huecos", () => {
  expect(shell("SettingsPage").match(/data-\[state=checked\]:shadow-none/g)).toHaveLength(2);
  expect(shell("SettingsPage")).toContain("flex shrink-0 flex-wrap gap-4");
  expect(shell("SettingsUpdateCheck")).toContain('controlsClassName="gap-3"');
});

it("distingue el resultado activo y los controles de guardado del Convertidor", () => {
  const preview = converter("Preview.tsx");
  expect(preview).toContain("data-[state=active]:bg-surface-raised");
  expect(preview).toContain("data-[state=active]:font-semibold");
  expect(preview).toContain("data-[state=active]:text-text");
  expect(preview).toContain('className="save-action bg-surface"');
  expect(preview).toContain("<SaveMarkdown chip");
  expect(preview).toContain('<SaveAllStack className="compact-icon" />');
  const stack = converter("SaveAllStack.tsx");
  expect(stack.match(/<Save size=\{13\}/g)).toHaveLength(2);
  expect(stack).toContain("opacity-70");
  const icon = readFileSync("packages/ui/src/SaveMarkdown.tsx", "utf8");
  expect(icon).toContain("bg-accent");
  expect(icon).toContain("text-accent-fg");
  expect(icon).toContain("leading-[10px]");
  const css = converter("styles.css");
  expect(css).toMatch(
    /\.queue-heading\s*\{[^}]*font-weight: 600;[^}]*color: var\(--ld-text-muted\)/,
  );
  expect(css).toMatch(/\.queue-card\s*\{[^}]*background: var\(--ld-bg\)/);
  expect(css).toMatch(/\.queue-card > button > span\s*\{[^}]*font-weight: 600/);
  expect(css).toMatch(/\.queue-panel\s*\{[^}]*padding: 12px 8px 8px;[^}]*border: 0/);
  expect(css).toMatch(/\.preview-panel\s*\{\s*border: 0/);
  expect(css).toMatch(/\.preview-toolbar\s*\{[^}]*gap: 4px/);
  expect(css).toMatch(/\.queue-card > \.col-span-2\s*\{\s*padding-top: 0/);
  expect(css).toMatch(/\.queue-card \.saved-indicator\s*\{\s*align-items: flex-start/);
  expect(css).toMatch(/\.saved-indicator\s*\{[^}]*width: 20px;\s*height: 20px/);
});
