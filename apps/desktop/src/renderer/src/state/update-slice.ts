import type {
  HostBridge,
  HostEventPayloads,
  UpdateCheckResult,
  UpdateSources,
} from "../../../shared/host-channels.ts";
import {
  applyUpdateResult,
  applyUpdateSources,
  initialUpdateState,
  type UpdateState,
  uncheckedSources,
} from "./update-state.ts";

export type UpdateSlice = UpdateState & {
  checkUpdates(bridge: HostBridge): Promise<void>;
  receiveUpdateSources(sources: UpdateSources): void;
  receiveAppUpdate(update: HostEventPayloads["update.available"]): void;
  receiveToolUpdates(payload: HostEventPayloads["tools.updatesAvailable"]): void;
  markUpdatesUnchecked(): void;
};
type SetUpdates = (
  patch: Partial<UpdateSlice> | ((state: UpdateSlice) => Partial<UpdateSlice>),
) => void;

export function createUpdateSlice(set: SetUpdates, get: () => UpdateSlice): UpdateSlice {
  return {
    ...initialUpdateState(),
    async checkUpdates(bridge) {
      if (get().updateChecking) return;
      set({ updateChecking: true });
      try {
        const response = await bridge.invoke("updates.checkNow", {});
        const result: UpdateCheckResult = response.ok ? response.data : { kind: "error" };
        set((state) => applyUpdateResult(state, result));
      } catch {
        set((state) => applyUpdateResult(state, { kind: "error" }));
      } finally {
        set({ updateChecking: false });
      }
    },
    receiveUpdateSources(sources) {
      set((state) => applyUpdateSources(state, sources));
    },
    receiveAppUpdate(update) {
      set((state) => ({
        update,
        ...(state.updateSources
          ? { updateSources: { ...state.updateSources, app: { status: "success", update } } }
          : {}),
      }));
    },
    receiveToolUpdates(payload) {
      set((state) => ({
        toolUpdates: payload.tools,
        toolIncompatible: payload.incompatible ?? [],
        updateSources: {
          ...(state.updateSources ?? uncheckedSources(state)),
          tools: {
            status: payload.status ?? "success",
            updates: payload.tools,
            incompatible: payload.incompatible ?? [],
          },
        },
      }));
    },
    markUpdatesUnchecked() {
      set((state) => ({ updateSources: state.updateSources ? uncheckedSources(state) : null }));
    },
  };
}
