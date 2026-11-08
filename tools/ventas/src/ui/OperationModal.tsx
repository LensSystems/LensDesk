import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@lensdesk/ui";
import type { ReactNode } from "react";
import type { Action } from "../shared/contracts.ts";
import { DialogFeedback } from "./DialogFeedback.tsx";
import type { ScreenProps } from "./types.ts";
import { useDialogOperation } from "./use-dialog-operation.ts";

export function OperationModal({
  title,
  description,
  label,
  close,
  onSubmit,
  children,
  onSaved,
  managedDialog = false,
  ...props
}: ScreenProps & {
  title: string;
  description: string;
  label: string;
  close: () => void;
  onSubmit: (data: FormData) => Action;
  children: ReactNode | ((changed: () => void) => ReactNode);
  onSaved?: (id: string) => void;
  managedDialog?: boolean;
}) {
  const form = useDialogOperation(props.run, props.operation, close, onSaved);
  const content = (
    <DialogContent>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
      <form
        className="grid gap-4"
        onChange={form.changed}
        onSubmit={(e) => {
          e.preventDefault();
          if (props.busy || form.savedDraft) return;
          form.submit(onSubmit(new FormData(e.currentTarget)));
        }}
      >
        <DialogFeedback operation={props.operation} savedDraft={form.savedDraft} />
        {typeof children === "function" ? children(form.changed) : children}
        <Button variant="primary" type="submit" disabled={props.busy || form.savedDraft}>
          {label}
        </Button>
      </form>
    </DialogContent>
  );
  return managedDialog ? (
    content
  ) : (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !props.operation.writing) close();
      }}
    >
      {content}
    </Dialog>
  );
}
