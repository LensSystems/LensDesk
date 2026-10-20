import { Grid2x2Plus, IconButton, SlidersHorizontal, X } from "@lensdesk/ui";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ShellTab } from "../../../shared/host-channels.ts";
import {
  HEADER_HEIGHT,
  MAC_TRAFFIC_LIGHTS_WIDTH,
  WIN_CONTROLS_WIDTH,
} from "../../../shared/layout.ts";
import { useShellStore } from "../state/store.ts";
import { HeaderNotices } from "./HeaderNotices.tsx";
import { toolIcon } from "./tool-icons.ts";
import { toolText } from "./tool-name.ts";

type TabBarProps = { tabs: ShellTab[]; bridge: Window["lensdeskHost"] };

export function TabBar({ tabs, bridge }: TabBarProps) {
  const { t, i18n } = useTranslation();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const fullScreen = useShellStore((state) => state.fullScreen);
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
    <header
      data-platform={bridge.platform}
      style={{
        height: HEADER_HEIGHT,
        paddingLeft:
          !fullScreen && bridge.platform === "darwin" ? MAC_TRAFFIC_LIGHTS_WIDTH : undefined,
        paddingRight:
          !fullScreen && bridge.platform === "win32" ? WIN_CONTROLS_WIDTH + 16 : undefined,
      }}
      className="ld-drag flex items-center gap-3 bg-bg px-4"
    >
      <div className="min-w-0 flex-1">
        <span className="block truncate font-bold text-muted">
          {t(fullScreen ? "shell.labelFullScreen" : "shell.label")}
        </span>
      </div>
      <div
        aria-label={t("shell.tabsLabel")}
        className={`flex min-w-0 max-w-1/2 shrink items-center gap-1 overflow-x-auto rounded-full ${tabs.length > 0 ? "bg-surface p-1" : ""}`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocusedIndex(null);
        }}
        role="tablist"
      >
        {tabs.map((tab, index) => {
          const tool = tools.find((candidate) => candidate.id === tab.toolId);
          const Icon = toolIcon((tool?.manifest as { icon?: unknown } | undefined)?.icon);
          const selected = page === "tab" && tab.active;
          return (
            <div
              className={`flex h-[30px] min-w-0 max-w-48 shrink-0 items-center rounded-full pr-1 transition-colors duration-150 ease-out motion-reduce:transition-none ${selected ? "bg-border font-semibold text-text" : "bg-transparent text-muted hover:bg-surface-raised"}`}
              key={tab.toolId}
              role="presentation"
            >
              <button
                aria-selected={selected}
                className="ld-no-drag flex h-full min-w-0 items-center gap-2 rounded-full px-3 text-[13px]"
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
                <Icon aria-hidden="true" className="ld-no-drag shrink-0" size={15} />
                <span className="truncate">{nameOf(tab.toolId)}</span>
              </button>
              <IconButton
                className="ld-no-drag size-6 shrink-0"
                tooltipSide="left"
                label={t("shell.closeTab", { name: nameOf(tab.toolId) })}
                onClick={() => void bridge.invoke("tabs.close", { toolId: tab.toolId })}
              >
                <X aria-hidden size={14} />
              </IconButton>
            </div>
          );
        })}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
        <HeaderNotices bridge={bridge} />
        <IconButton
          className="ld-no-drag shrink-0"
          label={t("shell.toolsPage")}
          tooltipSide="left"
          onClick={() => void showPage(bridge, "tools")}
        >
          <Grid2x2Plus aria-hidden size={17} />
        </IconButton>
        <IconButton
          className="ld-no-drag shrink-0"
          label={t("shell.settingsPage")}
          tooltipSide="left"
          onClick={() => void showPage(bridge, "settings")}
        >
          <SlidersHorizontal aria-hidden size={17} />
        </IconButton>
      </div>
    </header>
  );
}
