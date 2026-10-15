import { Plus, Settings, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ShellTab } from "../../../shared/host-channels.ts";
import { IconButton } from "../components/ui/IconButton.tsx";
import { useShellStore } from "../state/store.ts";

type TabBarProps = { tabs: ShellTab[]; bridge: Window["lensdeskHost"] };

export function TabBar({ tabs, bridge }: TabBarProps) {
  const { t } = useTranslation();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const page = useShellStore((state) => state.page);
  const showPage = useShellStore((state) => state.showPage);
  const [rovingIndex, setRovingIndex] = useState(
    Math.max(
      0,
      tabs.findIndex((tab) => tab.active),
    ),
  );
  useEffect(
    () =>
      setRovingIndex(
        Math.max(
          0,
          tabs.findIndex((tab) => tab.active),
        ),
      ),
    [tabs],
  );
  const moveFocus = (index: number) => tabRefs.current[index]?.focus();
  return (
    <header className="flex h-9 items-center gap-1 border-b border-border bg-surface px-1">
      <div
        aria-label={t("shell.tabsLabel")}
        className="flex min-w-0 flex-1 items-center gap-1"
        role="tablist"
      >
        {tabs.map((tab, index) => (
          <div className="flex h-7 items-center rounded border border-border" key={tab.toolId}>
            <button
              aria-selected={page === "tab" && tab.active}
              className="h-7 max-w-48 truncate px-2 text-text"
              onClick={() => void bridge.invoke("tabs.activate", { toolId: tab.toolId })}
              onKeyDown={(event) => {
                let target = index;
                if (event.key === "ArrowRight") target = (index + 1) % tabs.length;
                else if (event.key === "ArrowLeft")
                  target = (index - 1 + tabs.length) % tabs.length;
                else if (event.key === "Home") target = 0;
                else if (event.key === "End") target = tabs.length - 1;
                else return;
                event.preventDefault();
                setRovingIndex(target);
                moveFocus(target);
              }}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              role="tab"
              tabIndex={rovingIndex === index ? 0 : -1}
              type="button"
            >
              {tab.toolId}
            </button>
            <IconButton
              className="size-6"
              label={t("shell.closeTab", { name: tab.toolId })}
              onClick={() => void bridge.invoke("tabs.close", { toolId: tab.toolId })}
            >
              <X aria-hidden size={14} />
            </IconButton>
          </div>
        ))}
      </div>
      <IconButton label={t("shell.toolsPage")} onClick={() => void showPage(bridge, "tools")}>
        <Plus aria-hidden size={16} />
      </IconButton>
      <IconButton label={t("shell.settingsPage")} onClick={() => void showPage(bridge, "settings")}>
        <Settings aria-hidden size={16} />
      </IconButton>
    </header>
  );
}
