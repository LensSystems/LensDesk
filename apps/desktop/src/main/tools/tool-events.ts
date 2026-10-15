import type { ShellTab } from "../../shared/host-channels.ts";

export function publishTabsChanged(
  readTabs: () => ShellTab[],
  emit: (tabs: ShellTab[]) => void,
): void {
  emit(readTabs());
}
