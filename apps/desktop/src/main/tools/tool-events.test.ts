import { describe, expect, it, vi } from "vitest";
import { publishTabsChanged } from "./tool-events.ts";

describe("tool removal events", () => {
  it("emits the latest tab list after the removal cascade", () => {
    const tabs = [{ toolId: "remaining-tool", position: 0, active: true }];
    const readTabs = vi.fn(() => tabs);
    const emit = vi.fn();
    publishTabsChanged(readTabs, emit);
    expect(readTabs).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith(tabs);
  });
});
