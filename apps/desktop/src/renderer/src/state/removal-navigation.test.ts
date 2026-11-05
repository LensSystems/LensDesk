import { beforeEach, expect, it, vi } from "vitest";
import { createHostBridge } from "../../../shared/host-channels.ts";
import { useShellStore } from "./store.ts";
import { initialUpdateState } from "./update-state.ts";

beforeEach(() =>
  useShellStore.setState({
    ...initialUpdateState(),
    page: "tools",
    tabs: [{ toolId: "template", position: 0, active: true }],
    tools: [],
    pendingDowngrade: null,
  }),
);
it("eliminar una herramienta sin pestaña conserva Herramientas aunque otra pestaña siga activa", () => {
  const callbacks = new Map<string, (payload: unknown) => void>();
  const bridge = createHostBridge(vi.fn(), (event, callback) => {
    callbacks.set(event, callback);
    return () => callbacks.delete(event);
  });
  const off = useShellStore.getState().subscribe(bridge);
  try {
    callbacks.get("tabs.changed")?.({
      tabs: [{ toolId: "template", position: 0, active: true }],
      reason: "tool-removed",
    });
    expect(useShellStore.getState().page).toBe("tools");
  } finally {
    off();
  }
});

it.each(["tabs-first", "tools-first"])(
  "removal conserva página y reconcilia avisos en orden %s",
  (order) => {
    const callbacks = new Map<string, (payload: unknown) => void>();
    const bridge = createHostBridge(vi.fn(), (event, callback) => {
      callbacks.set(event, callback);
      return () => callbacks.delete(event);
    });
    const off = useShellStore.getState().subscribe(bridge);
    const tools = [
      {
        id: "notes",
        version: "0.4.0",
        manifest: {},
        enabled: true,
        signed: true,
        keyId: "release",
        installedAt: "",
        updatedAt: "",
      },
    ];
    useShellStore.setState({
      tools,
      toolUpdates: [{ id: "notes", version: "0.5.0", url: "https://example.com/tool" }],
      toolIncompatible: [
        {
          id: "notes",
          version: "0.6.0",
          apiVersion: 2,
          minHostVersion: "0.1.0",
          notesUrl: "https://example.com/release",
          reasons: ["apiVersion"],
        },
      ],
    });
    const tabs = () =>
      callbacks.get("tabs.changed")?.({
        tabs: [{ toolId: "template", position: 0, active: true }],
        reason: "tool-removed",
      });
    const removed = () => callbacks.get("tools.changed")?.({ tools: [], pendingDowngrade: null });
    try {
      if (order === "tabs-first") {
        tabs();
        removed();
      } else {
        removed();
        tabs();
      }
      expect(useShellStore.getState()).toMatchObject({
        page: "tools",
        toolUpdates: [],
        toolIncompatible: [],
      });
      // Explicit activation, even the identical already-active list, retains its meaning.
      callbacks.get("tabs.changed")?.({
        tabs: [{ toolId: "template", position: 0, active: true }],
      });
      expect(useShellStore.getState().page).toBe("tab");
    } finally {
      off();
    }
  },
);
