import { Button, Dialog, DialogTrigger } from "@lensdesk/ui";
import { Info, type LucideIcon } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Settings } from "../shared/values.ts";
import { SettingsDialogForm } from "./SettingsDialogForm.tsx";
import type { ScreenProps } from "./types.ts";

export function SettingsDialog({
  title,
  description,
  trigger,
  confirm,
  children,
  onSubmit,
  primary = false,
  disabled = false,
  triggerRef,
  onUnavailableTriggerFocus,
  icon: Icon = Info,
  ...props
}: ScreenProps & {
  title: string;
  description: string;
  trigger: string;
  confirm: string;
  children: ReactNode;
  onSubmit: (form: FormData, id: string) => Settings;
  primary?: boolean;
  disabled?: boolean;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  onUnavailableTriggerFocus?: () => boolean;
  icon?: LucideIcon;
}) {
  const { t } = useTranslation();
  const ownTrigger = useRef<HTMLButtonElement>(null);
  const targetTrigger = triggerRef ?? ownTrigger;
  const [open, setOpen] = useState(false);
  const [closeRequested, setCloseRequested] = useState(false);
  useEffect(() => {
    if (closeRequested && !props.busy && !props.operation.issue) {
      setCloseRequested(false);
      setOpen(false);
    }
  }, [closeRequested, props.busy, props.operation.issue]);
  const [id, setId] = useState(() => crypto.randomUUID());
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && props.operation.writing) return;
        setCloseRequested(false);
        if (next) setId(crypto.randomUUID());
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button
          ref={targetTrigger}
          variant={primary ? "primary" : "default"}
          disabled={props.busy || disabled}
        >
          {trigger}
        </Button>
      </DialogTrigger>
      {open ? (
        <SettingsDialogForm
          {...props}
          title={title}
          confirmedClosePending={closeRequested}
          icon={Icon}
          description={description}
          confirm={confirm}
          cancel={t("cancel")}
          close={() => setCloseRequested(true)}
          onSubmit={(form) => onSubmit(form, id)}
          onCloseAutoFocus={(event) => {
            const trigger = targetTrigger.current;
            if (trigger?.isConnected && !trigger.disabled && !trigger.closest("[hidden]")) return;
            event.preventDefault();
            if (onUnavailableTriggerFocus?.()) return;
            const focused = document.activeElement;
            if (
              focused instanceof HTMLElement &&
              focused !== document.body &&
              focused.isConnected &&
              !focused.closest('[role="dialog"]') &&
              !focused.hasAttribute("data-radix-focus-guard") &&
              !focused.closest("[hidden]")
            )
              return;
            const category = document.querySelector<HTMLElement>(
              '.ventas-settings-rail [role="tab"][aria-selected="true"]',
            );
            if (category?.isConnected && !category.closest("[hidden]")) category.focus();
          }}
        >
          {children}
        </SettingsDialogForm>
      ) : null}
    </Dialog>
  );
}
