import { Button, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@lensdesk/ui";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import type { Settings } from "../shared/values.ts";
import { DialogFeedback } from "./DialogFeedback.tsx";
import type { ScreenProps } from "./types.ts";
import { useDialogOperation } from "./use-dialog-operation.ts";

export function SettingsDialogForm({
  title,
  confirmedClosePending,
  icon: Icon,
  description,
  confirm,
  cancel,
  children,
  close,
  onSubmit,
  onCloseAutoFocus,
  ...props
}: ScreenProps & {
  title: string;
  confirmedClosePending: boolean;
  icon: LucideIcon;
  description: string;
  confirm: string;
  cancel: string;
  children: ReactNode;
  close: () => void;
  onSubmit: (form: FormData) => Settings;
  onCloseAutoFocus: ComponentProps<typeof DialogContent>["onCloseAutoFocus"];
}) {
  const form = useDialogOperation(props.run, props.operation, close);
  return (
    <DialogContent className="ventas-settings-dialog" onCloseAutoFocus={onCloseAutoFocus}>
      <div className="ventas-settings-dialog-heading">
        <span>
          <Icon size={21} aria-hidden="true" />
        </span>
        <DialogTitle>{title}</DialogTitle>
      </div>
      <DialogDescription>{description}</DialogDescription>
      <form
        className="grid gap-4"
        onChange={form.changed}
        onSubmit={(event) => {
          event.preventDefault();
          if (props.busy || form.savedDraft) return;
          form.submit({
            type: "saveSettings",
            settings: onSubmit(new FormData(event.currentTarget)),
          });
        }}
      >
        <DialogFeedback operation={props.operation} savedDraft={form.savedDraft} />
        <fieldset disabled={confirmedClosePending} className="grid min-w-0 gap-4">
          {children}
        </fieldset>
        <div className="ventas-settings-dialog-actions">
          <DialogClose asChild>
            <Button type="button" disabled={props.operation.writing}>
              {cancel}
            </Button>
          </DialogClose>
          <Button type="submit" variant="primary" disabled={props.busy || form.savedDraft}>
            {confirm}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
