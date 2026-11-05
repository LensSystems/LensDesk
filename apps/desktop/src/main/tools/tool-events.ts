import type { HostEventPayloads, ShellTab } from "../../shared/host-channels.ts";

// Removal publishes the remaining tabs, but does not request page activation.
export function publishTabsChanged(
  readTabs: () => ShellTab[],
  emit: (payload: HostEventPayloads["tabs.changed"]) => void,
): void {
  emit({ tabs: readTabs(), reason: "tool-removed" });
}
