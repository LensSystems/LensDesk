import { describe, expect, it } from "vitest";
import { ipcSchemas } from "./schemas.ts";
import { toolIpcSchemas } from "./tool-schemas.ts";

describe("esquemas de contexto", () => {
  it("acepta acento en el shell y lo valida", () => {
    const context = { locale: "es", theme: "dark", accent: "green" };
    expect(ipcSchemas["app.getContext"].response.parse(context)).toEqual(context);
    expect(
      ipcSchemas["app.getContext"].response.safeParse({ ...context, accent: "red" }).success,
    ).toBe(false);
  });
  it("acepta herramientas v1 con y sin acento", () => {
    const context = { locale: "es", theme: "dark", hostVersion: "1", toolVersion: "1" };
    const schema = toolIpcSchemas["app.getContext"].response;
    expect(schema.parse(context)).toEqual(context);
    expect(schema.parse({ ...context, accent: "green" })).toEqual({ ...context, accent: "green" });
    expect(schema.safeParse({ ...context, accent: "red" }).success).toBe(false);
  });
});
