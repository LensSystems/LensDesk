import { Grid2x2Plus, IconButton, SlidersHorizontal } from "@lensdesk/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ShellTab } from "../../../shared/host-channels.ts";
import {
  HEADER_HEIGHT,
  MAC_TRAFFIC_LIGHTS_WIDTH,
  WIN_CONTROLS_WIDTH,
} from "../../../shared/layout.ts";
import { useShellStore } from "../state/store.ts";
import { HeaderNotices } from "./HeaderNotices.tsx";
import { TabItem } from "./TabItem.tsx";
import { toolIcon } from "./tool-icons.ts";
import { toolText } from "./tool-name.ts";

type TabBarProps = { tabs: ShellTab[]; bridge: Window["lensdeskHost"] };

export function TabBar({ tabs, bridge }: TabBarProps) {
  const { t, i18n } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState({ available: Infinity, required: 0 });
  const compact = tabs.length > 5 || space.available < space.required;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const fullScreen = useShellStore((state) => state.fullScreen);
  const page = useShellStore((state) => state.page);
  const showPage = useShellStore((state) => state.showPage);
  const tools = useShellStore((state) => state.tools);
  const names = useMemo(
    () =>
      tabs.map((tab) => {
        const tool = tools.find((candidate) => candidate.id === tab.toolId);
        return tool ? toolText(tool, i18n.resolvedLanguage).name : tab.toolId;
      }),
    [tabs, tools, i18n.resolvedLanguage],
  );
  useEffect(() => {
    const container = listRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const labels = [...container.querySelectorAll<HTMLElement>("[data-tab-name]")];
      const widths = names.map((_, index) => labels[index]?.scrollWidth ?? 0);
      // Icono, cierre, relleno y separación de cada pestaña desplegada.
      const required = widths.every((width) => width > 0)
        ? widths.reduce(
            (sum, width) => sum + Math.min(192, width + 75),
            8 + Math.max(0, widths.length - 1) * 4,
          )
        : names.length * 192;
      setSpace({ available: entry.contentRect.width, required });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [names]);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.active),
  );
  // Mientras el foco está dentro de la barra manda el índice enfocado; fuera de ella, la pestaña activa.
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const rovingIndex = Math.min(focusedIndex ?? activeIndex, Math.max(0, tabs.length - 1));
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
      className="ld-drag @container relative flex items-center gap-2 bg-bg px-4 @max-[1000px]:gap-1"
    >
      <div
        data-brand
        className="w-48 shrink-0 transition-[width,padding] duration-150 ease-out motion-reduce:transition-none @max-[1000px]:w-8"
      >
        <span className="block truncate font-bold text-muted @max-[1000px]:hidden">
          {t(fullScreen ? "shell.labelFullScreen" : "shell.label")}
        </span>
        <span className="hidden font-bold text-muted @max-[1000px]:block">
          {t("shell.labelCompact")}
        </span>
      </div>
      <div
        ref={listRef}
        className="flex min-w-0 flex-1 justify-center transition-[width,padding] duration-150 ease-out motion-reduce:transition-none"
      >
        <div
          aria-label={t("shell.tabsLabel")}
          className={`flex min-w-0 max-w-full shrink items-center gap-1 overflow-hidden rounded-full ${tabs.length > 0 ? "bg-surface p-1" : ""}`}
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
              <TabItem
                key={tab.toolId}
                tab={tab}
                bridge={bridge}
                name={names[index] ?? tab.toolId}
                Icon={Icon}
                selected={selected}
                compact={compact && !tab.active}
                tabIndex={rovingIndex === index ? 0 : -1}
                buttonRef={(node) => {
                  tabRefs.current[index] = node;
                }}
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
              />
            );
          })}
        </div>
      </div>
      <div className="flex min-w-0 w-64 shrink-0 items-center justify-end gap-1 @max-[1000px]:w-56">
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
