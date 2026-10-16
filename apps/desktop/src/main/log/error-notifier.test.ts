import { describe, expect, it, vi } from "vitest";
import { createErrorNotifier } from "./error-notifier.ts";

describe("aviso por errores no capturados", () => {
  it("emite como mucho una vez por intervalo y solo lleva el tipo", () => {
    let now = 1_000;
    const emit = vi.fn();
    const notify = createErrorNotifier({ now: () => now, minIntervalMs: 10_000, emit });
    notify("uncaught");
    now += 9_999;
    notify("rejection");
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith({ kind: "uncaught" });
    now += 1;
    notify("rejection");
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenLastCalledWith({ kind: "rejection" });
  });
});
