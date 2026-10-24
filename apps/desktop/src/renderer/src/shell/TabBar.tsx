import { Grid2x2Plus, IconButton, SlidersHorizontal } from "@lensdesk/ui";
import { useMemo, useRef, useState } from "react";
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
import { useTabDrag } from "./use-tab-drag.ts";
import { tabInsets, useCompactTabs, useTabCenter } from "./use-tab-layout.ts";

type TabBarProps = { tabs: ShellTab[]; bridge: Window["lensdeskHost"] };
export function TabBar({ tabs, bridge }: TabBarProps) {
  const { t, i18n } = useTranslation();
  const [announcement, setAnnouncement] = useState("");
  const reorder = async (toolId: string, toIndex: number) => {
    if (toIndex < 0 || toIndex >= tabs.length) return;
    const result = await bridge.invoke("tabs.move", { toolId, toIndex });
    if (!result.ok) return;
    setFocusedIndex(toIndex);
    requestAnimationFrame(() => tabRefs.current[toIndex]?.focus());
    const tool = tools.find((candidate) => candidate.id === toolId);
    setAnnouncement(
      t("shell.tabPosition", {
        name: tool ? toolText(tool, i18n.resolvedLanguage).name : toolId,
        n: toIndex + 1,
        total: result.data.tabs.length,
      }),
    );
  };
  const drag = useTabDrag((toolId, index) => void reorder(toolId, index));
  const hasNotice = useShellStore(
    (state) =>
      (!!state.update && state.update.version !== state.dismissedVersion) ||
      state.toasts.length > 0,
  );
  const { headerRef, brandRef, actionsRef, width, left, right, naturalRight } = useTabCenter();
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const fullScreen = useShellStore((state) => state.fullScreen);
  const windowInset = bridge.platform === "win32" && !fullScreen ? WIN_CONTROLS_WIDTH + 16 : 16;
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
  const activeIndex = tabs.findIndex((tab) => tab.active);
  const { compact, required } = useCompactTabs(
    listRef,
    names,
    width < 900 && page !== "tab" ? -1 : activeIndex,
    width - left - (hasNotice ? naturalRight : right),
    width,
  );
  const insets = hasNotice ? { left, right } : tabInsets(width, left, right, required);
  // Mientras el foco está dentro de la barra manda el índice enfocado; fuera de ella, la pestaña activa.
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const rovingIndex = Math.max(0, Math.min(focusedIndex ?? activeIndex, tabs.length - 1));
  const moveFocus = (index: number) => tabRefs.current[index]?.focus();
  return (
    <header
      ref={headerRef}
      data-platform={bridge.platform}
      data-has-notice={hasNotice}
      style={{
        height: HEADER_HEIGHT,
        paddingLeft:
          !fullScreen && bridge.platform === "darwin" ? MAC_TRAFFIC_LIGHTS_WIDTH : undefined,
        paddingRight:
          !fullScreen && bridge.platform === "win32" ? WIN_CONTROLS_WIDTH + 16 : undefined,
      }}
      className={`ld-drag @container relative flex items-center bg-bg px-4 ${hasNotice ? "justify-between gap-3" : "gap-2 @max-[880px]:gap-1"}`}
    >
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
      <div
        ref={brandRef}
        data-brand
        className={`${hasNotice ? "w-auto" : "w-48"} shrink-0 transition-[width,padding] duration-150 ease-out motion-reduce:transition-none @max-[880px]:w-8`}
      >
        <span className="block truncate font-bold text-muted @max-[880px]:hidden">
          {t(fullScreen ? "shell.labelFullScreen" : "shell.label")}
        </span>
        <span className="hidden font-bold text-muted @max-[880px]:block">
          {t("shell.labelCompact")}
        </span>
      </div>
      <div
        ref={listRef}
        style={hasNotice ? { maxWidth: required } : insets}
        className={`${hasNotice ? "relative w-max shrink-0" : "absolute"} flex min-w-0 justify-center transition-[left,right] duration-160 ease-out motion-reduce:transition-none`}
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
                index={index}
                total={tabs.length}
                drag={drag}
                dropAfter={drag.drop?.index === tabs.length - 1 && index === tabs.length - 1}
                dropBefore={
                  drag.drop !== null &&
                  index ===
                    drag.drop.index +
                      (tabs.findIndex((item) => item.toolId === drag.drop?.toolId) <=
                      drag.drop.index
                        ? 1
                        : 0)
                }
                bridge={bridge}
                name={names[index] ?? tab.toolId}
                Icon={Icon}
                selected={selected}
                compact={compact && !(width < 900 ? selected : tab.active)}
                tabIndex={rovingIndex === index ? 0 : -1}
                buttonRef={(node) => {
                  tabRefs.current[index] = node;
                }}
                onFocus={() => setFocusedIndex(index)}
                onKeyDown={(event) => {
                  if (
                    event.ctrlKey &&
                    event.shiftKey &&
                    (event.key === "ArrowLeft" || event.key === "ArrowRight")
                  ) {
                    event.preventDefault();
                    void reorder(tab.toolId, index + (event.key === "ArrowRight" ? 1 : -1));
                    return;
                  }
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
      <div
        ref={actionsRef}
        style={{
          maxWidth:
            hasNotice && Number.isFinite(width)
              ? Math.max(0, width - left - required - 12 - windowInset)
              : "50%",
        }}
        className={`${hasNotice ? "" : "ml-auto"} flex min-w-0 items-center justify-end gap-1`}
      >
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
