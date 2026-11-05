import { describe, expect, it } from "vitest";
import { createHostBridge } from "../../shared/host-channels.ts";
import { ipcSchemas } from "./schemas.ts";
import { updateSourcesSchema, updatesCheckedEventSchema } from "./update-schemas.ts";

const schema = ipcSchemas["updates.checkNow"].response;
const update = {
  id: "notes",
  version: "0.4.5",
  url: "https://github.com/LensSystems/LensDesk/releases/download/notes-v0.4.5/notes-0.4.5.lenspkg",
};
describe("contrato aditivo de actualizaciones", () => {
  it.each([
    { kind: "skipped" },
    { kind: "error" },
    { kind: "none" },
    { kind: "none", tools: [update] },
    {
      kind: "available",
      version: "1.0.0",
      url: "https://example.com/release",
      installerUrl: "https://example.com/package",
      tools: [update],
    },
  ])("conserva payload antiguo %j", (payload) => {
    expect(schema.parse(payload)).toEqual(payload);
  });
  it("acepta fuentes independientes con datos previos marcados error e incompatibles", () => {
    const sources = {
      app: {
        status: "error",
        update: {
          version: "0.5.0",
          html_url: "https://github.com/LensSystems/LensDesk/releases/tag/v0.5.0",
        },
      },
      tools: {
        status: "success",
        updates: [update],
        incompatible: [
          {
            id: "notes",
            version: "0.6.0",
            apiVersion: 2,
            minHostVersion: "0.6.0",
            notesUrl: "https://github.com/LensSystems/LensDesk/releases/tag/notes-v0.6.0",
            reasons: ["apiVersion", "minHostVersion"],
          },
        ],
      },
    };
    expect(schema.safeParse({ kind: "error", sources, tools: [update] }).success).toBe(true);
    expect(updatesCheckedEventSchema.parse({ sources })).toEqual({ sources });
    expect(
      updateSourcesSchema.safeParse({ ...sources, app: { ...sources.app, status: "updated" } })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({
        kind: "none",
        sources: { ...sources, tools: { ...sources.tools, injected: true } },
      }).success,
    ).toBe(false);
  });
  it("el nuevo evento llega por el bridge permitido sin eliminar eventos anteriores", () => {
    const subscriptions: string[] = [];
    const bridge = createHostBridge(
      async () => ({ ok: true, value: {} }),
      (event) => {
        subscriptions.push(event);
        return () => {};
      },
    );
    bridge.on("updates.checked", () => {});
    bridge.on("update.available", () => {});
    bridge.on("tools.updatesAvailable", () => {});
    expect(subscriptions).toEqual([
      "updates.checked",
      "update.available",
      "tools.updatesAvailable",
    ]);
  });
});
