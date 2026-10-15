import { createTestContext } from "@lensdesk/sdk/backend/testing";
import { LensError } from "@lensdesk/sdk/errors";
import { describe, expect, it } from "vitest";
import { methods } from "../src/backend/index.ts";

describe("template backend", () => {
  it("returns a valid ping timestamp", async () => {
    const result = (await methods.ping(undefined)) as { pong: boolean; at: string };
    expect(result.pong).toBe(true);
    expect(result.at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(Number.isNaN(Date.parse(result.at))).toBe(false);
  });

  it("reports progress and cancels quickly", async () => {
    const context = createTestContext({ dataDir: "/tmp/template" });
    const controller = new AbortController();
    const slowContext = { ...context, signal: controller.signal };
    const started = Date.now();
    const call = methods.slow(undefined, slowContext);
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();
    await expect(call).rejects.toMatchObject({ code: "E_CANCELLED" });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(context.progressEvents.length).toBeGreaterThan(0);
    expect(context.progressEvents[0]?.fraction).toBe(0.1);
  });

  it("rechaza parámetros que no espera", () => {
    expect(() => methods.ping({ extra: 1 })).toThrow(LensError);
    expect(() => methods.ping({})).not.toThrow();
  });
});
