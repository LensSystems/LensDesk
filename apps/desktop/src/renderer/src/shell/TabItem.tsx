import { IconButton, X } from "@lensdesk/ui";
import type { ComponentType, KeyboardEventHandler, Ref } from "react";
import { useTranslation } from "react-i18next";
import type { HostBridge, ShellTab } from "../../../shared/host-channels.ts";
import type { useTabDrag } from "./use-tab-drag.ts";

type Props = {
  tab: ShellTab;
  index: number;
  total: number;
  drag: ReturnType<typeof useTabDrag>;
  dropBefore: boolean;
  dropAfter: boolean;
  bridge: HostBridge;
  name: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  selected: boolean;
  compact: boolean;
  tabIndex: number;
  buttonRef: Ref<HTMLButtonElement>;
  onFocus(): void;
  onKeyDown: KeyboardEventHandler<HTMLButtonElement>;
};

export function TabItem({
  tab,
  index,
  total,
  drag,
  dropBefore,
  dropAfter,
  bridge,
  name,
  Icon,
  selected,
  compact,
  tabIndex,
  buttonRef,
  onFocus,
  onKeyDown,
}: Props) {
  const { t } = useTranslation();
  return (
    <>
      {dropBefore && (
        <span
          aria-hidden="true"
          className="h-7 w-8 shrink-0 rounded-full border border-dashed border-border-control"
        />
      )}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: El cierre central abarca ambos botones; el teclado usa el botón de cierre. */}
      <div
        className={`group relative flex h-[30px] min-w-0 max-w-48 items-center rounded-full transition-colors duration-150 ease-out motion-reduce:transition-none ${compact ? "w-[31px] shrink-0" : "shrink"} ${selected ? "bg-border font-semibold text-text" : "bg-transparent text-muted hover:bg-surface-raised"}`}
        onAuxClick={(event) => {
          if (event.button === 1) void bridge.invoke("tabs.close", { toolId: tab.toolId });
        }}
        onMouseDown={(event) => {
          if (event.button === 1) event.preventDefault();
        }}
        role="presentation"
      >
        <button
          aria-posinset={index + 1}
          aria-setsize={total}
          aria-selected={selected}
          aria-label={name}
          title={compact ? name : undefined}
          className={`ld-no-drag flex h-full touch-none min-w-0 items-center rounded-full text-[13px] ${compact ? "w-full justify-center px-2" : "w-full justify-center px-[21.5px]"}`}
          onPointerDown={(event) => drag.onPointerDown(event, tab.toolId)}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
          onPointerCancel={drag.onPointerCancel}
          onLostPointerCapture={drag.onPointerCancel}
          onClick={() => {
            if (!drag.consumeClick()) void bridge.invoke("tabs.activate", { toolId: tab.toolId });
          }}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          ref={buttonRef}
          role="tab"
          tabIndex={tabIndex}
          type="button"
        >
          <span
            className={`flex min-w-0 items-center gap-2 ${compact ? "" : "transition-transform duration-[140ms] ease-out group-hover:-translate-x-[9.5px] group-has-[:focus-visible]:-translate-x-[9.5px] motion-reduce:transition-none"}`}
          >
            <Icon aria-hidden="true" className="ld-no-drag shrink-0" size={15} />
            <span data-tab-name className={compact ? "sr-only whitespace-nowrap" : "truncate"}>
              {name}
            </span>
          </span>
        </button>
        {!compact && (
          <IconButton
            tooltip={false}
            className="ld-no-drag absolute right-[3px] size-6 shrink-0 opacity-0 transition-opacity duration-[140ms] ease-out group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 motion-reduce:transition-none"
            tooltipSide="left"
            label={t("shell.closeTab", { name })}
            onClick={() => void bridge.invoke("tabs.close", { toolId: tab.toolId })}
          >
            <X aria-hidden size={13} />
          </IconButton>
        )}
      </div>
      {dropAfter && (
        <span
          aria-hidden="true"
          className="h-7 w-8 shrink-0 rounded-full border border-dashed border-border-control"
        />
      )}
    </>
  );
}
