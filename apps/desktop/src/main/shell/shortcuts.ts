export const SHORTCUTS = {
  tools: "CmdOrCtrl+T",
  closeTab: "CmdOrCtrl+W",
  nextTab: "Ctrl+Tab",
  previousTab: "Ctrl+Shift+Tab",
  settings: "CmdOrCtrl+,",
  tab: (index: number): string => `CmdOrCtrl+${index}`,
} as const;
