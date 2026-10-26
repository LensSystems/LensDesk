import { describe, expect, it } from "vitest";
import { ipcSchemas } from "./schemas.ts";

describe("tabs.move", () => {
  it("acepta una posición entera y rechaza parámetros mal formados", () => {
    const schema = ipcSchemas["tabs.move"].request;
    expect(schema.parse({ toolId: "notes", toIndex: 0 })).toEqual({ toolId: "notes", toIndex: 0 });
    for (const payload of [
      {},
      { toolId: "", toIndex: 0 },
      { toolId: "notes", toIndex: -1 },
      { toolId: "notes", toIndex: 0.5 },
      { toolId: "notes", toIndex: "1" },
      { toolId: "notes", toIndex: 1, extra: true },
    ])
      expect(schema.safeParse(payload).success).toBe(false);
  });
});
