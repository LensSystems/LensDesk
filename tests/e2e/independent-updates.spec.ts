import { expect, test } from "@playwright/test";
import { enableDeveloperMode, installTool, launchApp, lenspkgPath, shellPage } from "./helpers.ts";

type FixtureScope = typeof globalThis & {
  independentUpdateFixture?: {
    calls: string[];
    failCatalog: boolean;
    release(): void;
    restore(): void;
  };
};

test("host consulta dos fuentes locales, comparte búsquedas y reconcilia sin GET", async () => {
  const app = await launchApp({ updatesCheckedRecently: true });
  try {
    const page = await shellPage(app);
    const rendererRequests: string[] = [];
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) rendererRequests.push(request.url());
    });
    await app.evaluate(() => {
      const scope = globalThis as FixtureScope;
      const original = globalThis.fetch;
      let release = () => {};
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      const fixture = {
        calls: [] as string[],
        failCatalog: false,
        release,
        restore: () => {
          globalThis.fetch = original;
          delete scope.independentUpdateFixture;
        },
      };
      scope.independentUpdateFixture = fixture;
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        fixture.calls.push(url);
        if (init?.method !== "GET" || init.redirect !== "error" || init.body)
          throw Error("Unexpected update request");
        await pending;
        if (url === "https://api.github.com/repos/LensSystems/LensDesk/releases/latest")
          return Response.json({
            tag_name: "v0.4.0",
            html_url: "https://github.com/LensSystems/LensDesk/releases/tag/v0.4.0",
          });
        if (url !== "https://lenssystems.github.io/LensDesk/tools-catalog-v1.json")
          throw Error("Unexpected endpoint");
        if (fixture.failCatalog) return new Response("offline", { status: 429 });
        return Response.json({
          schemaVersion: 1,
          repository: "LensSystems/LensDesk",
          generatedAt: "2026-11-04T12:00:00.000Z",
          releases: ["0.4.5", "0.6.0"].map((version) => ({
            schemaVersion: 1,
            repository: "LensSystems/LensDesk",
            id: "notes",
            version,
            apiVersion: 1,
            minHostVersion: version === "0.6.0" ? "0.6.0" : "0.1.0",
            releaseTag: `notes-v${version}`,
            asset: {
              name: `notes-${version}.lenspkg`,
              url: `https://github.com/LensSystems/LensDesk/releases/download/notes-v${version}/notes-${version}.lenspkg`,
              size: 10,
              sha256: "a".repeat(64),
            },
            notesUrl: `https://github.com/LensSystems/LensDesk/releases/tag/notes-v${version}`,
          })),
        });
      };
    });
    const calls = () =>
      app.evaluate(() => (globalThis as FixtureScope).independentUpdateFixture?.calls ?? []);
    await enableDeveloperMode(page);
    await installTool(app, page, lenspkgPath("notes"), "Notas");
    expect(await calls()).toEqual([]);
    const pending = page.evaluate(async () =>
      Promise.all([
        window.lensdeskHost.invoke("updates.checkNow", {}),
        window.lensdeskHost.invoke("updates.checkNow", {}),
      ]),
    );
    await expect
      .poll(calls)
      .toEqual([
        "https://api.github.com/repos/LensSystems/LensDesk/releases/latest",
        "https://lenssystems.github.io/LensDesk/tools-catalog-v1.json",
      ]);
    await app.evaluate(() => (globalThis as FixtureScope).independentUpdateFixture?.release());
    const results = await pending;
    expect(results[0]).toEqual(results[1]);
    expect(results[0]).toMatchObject({
      ok: true,
      data: {
        kind: "none",
        tools: [{ id: "notes", version: "0.4.5" }],
        sources: {
          app: { status: "success", update: null },
          tools: {
            status: "success",
            incompatible: [{ id: "notes", version: "0.6.0", reasons: ["minHostVersion"] }],
          },
        },
      },
    });
    await app.evaluate(() => {
      const fixture = (globalThis as FixtureScope).independentUpdateFixture;
      if (fixture) fixture.failCatalog = true;
    });
    const partial = await page.evaluate(() => window.lensdeskHost.invoke("updates.checkNow", {}));
    expect(partial).toMatchObject({
      ok: true,
      data: {
        sources: {
          app: { status: "success" },
          tools: { status: "error", updates: [{ id: "notes", version: "0.4.5" }] },
        },
      },
    });
    const count = (await calls()).length;
    const toolsEvents = await page.evaluate(async () => {
      const events: { tools: { id: string }[]; status?: string }[] = [];
      const unsubscribe = window.lensdeskHost.on("tools.updatesAvailable", (payload) =>
        events.push(payload),
      );
      try {
        const result = await window.lensdeskHost.invoke("tools.remove", {
          toolId: "notes",
          deleteData: false,
        });
        if (!result.ok) throw Error(result.error.message);
        return events;
      } finally {
        unsubscribe();
      }
    });
    expect(toolsEvents.length).toBeGreaterThan(0);
    expect(toolsEvents.at(-1)).toMatchObject({ tools: [], status: "error" });
    expect((await calls()).length).toBe(count);
    expect(rendererRequests).toEqual([]);
  } finally {
    await app
      .evaluate(() => {
        const fixture = (globalThis as FixtureScope).independentUpdateFixture;
        fixture?.release();
        fixture?.restore();
      })
      .catch(() => undefined);
    await app.close();
  }
});
