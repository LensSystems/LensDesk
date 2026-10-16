import { Plus, Settings, X } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ShellTab } from "../../../shared/host-channels.ts";
import { IconButton } from "../components/ui/IconButton.tsx";
import { useShellStore } from "../state/store.ts";
import { HeaderNotices } from "./HeaderNotices.tsx";
import { toolText } from "./tool-name.ts";

type TabBarProps = { tabs: ShellTab[]; bridge: Window["lensdeskHost"] };

export function TabBar({ tabs, bridge }: TabBarProps) {
  const { t, i18n } = useTranslation();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const page = useShellStore((state) => state.page);
  const showPage = useShellStore((state) => state.showPage);
  const tools = useShellStore((state) => state.tools);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.active),
  );
  // Mientras el foco está dentro de la barra manda el índice enfocado; fuera de ella, la pestaña activa.
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const rovingIndex = Math.min(focusedIndex ?? activeIndex, Math.max(0, tabs.length - 1));
  const nameOf = (toolId: string) => {
    const tool = tools.find((candidate) => candidate.id === toolId);
    return tool ? toolText(tool, i18n.resolvedLanguage).name : toolId;
  };
  const moveFocus = (index: number) => tabRefs.current[index]?.focus();
  return (
    <header className="flex h-9 items-center gap-1 overflow-hidden border-b border-border bg-surface px-1">
      <div
        aria-label={t("shell.tabsLabel")}
        className="flex min-w-0 flex-1 items-center gap-1"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocusedIndex(null);
        }}
        role="tablist"
      >
        {tabs.map((tab, index) => (
          <div
            className="flex h-7 items-center rounded border border-border"
            key={tab.toolId}
            role="presentation"
          >
            <button
              aria-selected={page === "tab" && tab.active}
              className="h-7 max-w-48 truncate px-2 text-text"
              onClick={() => void bridge.invoke("tabs.activate", { toolId: tab.toolId })}
              onFocus={() => setFocusedIndex(index)}
              onKeyDown={(event) => {
                let target = index;
                if (event.key === "ArrowRight") target = (index + 1) % tabs.length;
                else if (event.key === "ArrowLeft")
                  target = (index - 1 + tabs.length) % tabs.length;
                else if (event.key === "Home") target = 0;
                else if (event.key === "End") target = tabs.length - 1;
                else return;
                event.preventDefault();
                setFocusedIndex(target);
                moveFocus(target);
              }}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              role="tab"
              tabIndex={rovingIndex === index ? 0 : -1}
              type="button"
            >
              {nameOf(tab.toolId)}
            </button>
            <IconButton
              className="size-6"
              tooltipSide="left"
              label={t("shell.closeTab", { name: nameOf(tab.toolId) })}
              onClick={() => void bridge.invoke("tabs.close", { toolId: tab.toolId })}
            >
              <X aria-hidden size={14} />
            </IconButton>
          </div>
        ))}
      </div>
      <HeaderNotices bridge={bridge} />
      <IconButton
        label={t("shell.toolsPage")}
        tooltipSide="left"
        onClick={() => void showPage(bridge, "tools")}
      >
        <Plus aria-hidden size={16} />
      </IconButton>
      <IconButton
        label={t("shell.settingsPage")}
        tooltipSide="left"
        onClick={() => void showPage(bridge, "settings")}
      >
        <Settings aria-hidden size={16} />
      </IconButton>
    </header>
  );
}
