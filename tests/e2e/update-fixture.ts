import type { ElectronApplication } from "@playwright/test";

export type UpdateScenario =
  | "tools"
  | "both"
  | "app"
  | "none"
  | "app-error"
  | "tools-error"
  | "error"
  | "api";
type Scope = typeof globalThis & {
  updateNavigationFixture?: {
    calls: string[];
    scenario: UpdateScenario;
    minimum: string;
    restore(): void;
  };
};
export async function mockUpdateSources(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ app }) => {
    const scope = globalThis as Scope;
    const original = globalThis.fetch;
    const currentVersion = app.getVersion();
    const fixture = {
      calls: [] as string[],
      scenario: "tools" as UpdateScenario,
      minimum: "0.9.0",
      restore: () => {
        globalThis.fetch = original;
        delete scope.updateNavigationFixture;
      },
    };
    scope.updateNavigationFixture = fixture;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      fixture.calls.push(url);
      if (
        init?.method !== "GET" ||
        init.redirect !== "error" ||
        init.credentials !== "omit" ||
        init.body
      )
        throw Error("Unexpected update request");
      const scenario = fixture.scenario;
      if (url === "https://api.github.com/repos/LensSystems/LensDesk/releases/latest") {
        if (scenario === "app-error" || scenario === "error")
          return new Response("blocked", { status: 403 });
        const version = scenario === "both" || scenario === "app" ? "0.8.0" : currentVersion;
        return Response.json({
          tag_name: `v${version}`,
          html_url: `https://github.com/LensSystems/LensDesk/releases/tag/v${version}`,
        });
      }
      if (url !== "https://lenssystems.github.io/LensDesk/tools-catalog-v1.json")
        throw Error("Unexpected endpoint");
      if (scenario === "tools-error" || scenario === "error")
        return new Response("limited", { status: 429 });
      const metadata = (id: string, version: string, minHostVersion: string, apiVersion = 1) => ({
        schemaVersion: 1,
        repository: "LensSystems/LensDesk",
        id,
        version,
        minHostVersion,
        apiVersion,
        releaseTag: `${id}-v${version}`,
        asset: {
          name: `${id}-${version}.lenspkg`,
          url: `https://github.com/LensSystems/LensDesk/releases/download/${id}-v${version}/${id}-${version}.lenspkg`,
          size: 10,
          sha256: "a".repeat(64),
        },
        notesUrl: `https://github.com/LensSystems/LensDesk/releases/tag/${id}-v${version}`,
      });
      const releases =
        scenario === "none" || scenario === "app"
          ? []
          : [
              metadata("notes", "0.5.0", "0.1.0"),
              metadata("md-converter", "0.5.0", "0.1.0"),
              metadata(
                "notes",
                "0.9.0",
                scenario === "api" ? "0.1.0" : fixture.minimum,
                scenario === "api" ? 2 : 1,
              ),
            ];
      return Response.json({
        schemaVersion: 1,
        repository: "LensSystems/LensDesk",
        generatedAt: "2026-11-04T12:00:00.000Z",
        releases,
      });
    };
  });
}
export async function updateScenario(
  app: ElectronApplication,
  scenario: UpdateScenario,
  minimum = "0.9.0",
) {
  await app.evaluate(
    (_electron, { scenario, minimum }) => {
      const fixture = (globalThis as Scope).updateNavigationFixture;
      if (!fixture) throw Error("Missing update fixture");
      fixture.scenario = scenario;
      fixture.minimum = minimum;
    },
    { scenario, minimum },
  );
}
export const updateRequests = (app: ElectronApplication) =>
  app.evaluate(() => (globalThis as Scope).updateNavigationFixture?.calls ?? []);
export const restoreUpdateSources = (app: ElectronApplication) =>
  app.evaluate(() => (globalThis as Scope).updateNavigationFixture?.restore());
