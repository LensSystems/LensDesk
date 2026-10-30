import { Button, Dialog, DialogContent, DialogTitle } from "@lensdesk/ui";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AddCredentialField } from "./AddCredentialField.tsx";
import { CredentialFieldRow } from "./CredentialFieldRow.tsx";
import type { Credential } from "./credential-block.ts";
import { SecretField } from "./SecretField.tsx";
export function CredentialDialog({
  initial,
  onSave,
  onClose,
  onReturnFocus,
}: {
  initial: Credential;
  onSave: (value: Credential) => void;
  onClose: () => void;
  onReturnFocus?: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initial);
  const [ids, setIds] = useState(() => initial.fields.map(() => crypto.randomUUID()));
  const [focused, setFocused] = useState("");
  // El foco pasa al campo nuevo cuando el menú ya se cerró; antes, el menú lo retiene.
  const pending = useRef("");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          if (!onReturnFocus) return;
          event.preventDefault();
          if (!document.querySelector('[role="dialog"], [role="alertdialog"]')) onReturnFocus();
        }}
        closeLabel={t("close")}
        closeClassName="hidden"
        aria-describedby={undefined}
        className="credential-dialog grid-cols-[minmax(0,1fr)] max-h-[90vh] w-[520px] gap-3 overflow-auto p-5"
      >
        <DialogTitle className="text-[17px] leading-[24.65px]">
          {t("credential.addTitle")}
        </DialogTitle>
        <form
          className="flex min-w-0 flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(value);
          }}
        >
          <SecretField
            compact
            label={t("credential.user")}
            value={value.user}
            onChange={(event) => setValue({ ...value, user: event.target.value })}
          />
          <SecretField
            compact
            label={t("credential.password")}
            secret
            mono
            value={value.password}
            onChange={(event) => setValue({ ...value, password: event.target.value })}
          />
          <label className="grid gap-1 text-xs leading-[17.4px] font-semibold text-muted">
            {t("credential.note")}
            <textarea
              className="h-[66px] rounded-ld-md border border-border-control bg-bg px-2.5 py-[9px] text-[13px] font-normal leading-[18.85px] text-text"
              value={value.note}
              onChange={(event) => setValue({ ...value, note: event.target.value })}
            />
          </label>
          {value.fields.length > 0 && (
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 [&>div]:min-w-0 [&>div]:grid-cols-[minmax(0,1fr)]">
              {value.fields.map((field, index) => (
                <CredentialFieldRow
                  key={ids[index]}
                  field={field}
                  autoFocus={ids[index] === focused}
                  onChange={(next) =>
                    setValue({
                      ...value,
                      fields: value.fields.map((item, i) => (i === index ? next : item)),
                    })
                  }
                  onRemove={() => {
                    setIds(ids.filter((_, i) => i !== index));
                    setValue({ ...value, fields: value.fields.filter((_, i) => i !== index) });
                  }}
                />
              ))}
            </div>
          )}
          <AddCredentialField
            onClosed={() => setFocused(pending.current)}
            onAdd={(secret) => {
              const id = crypto.randomUUID();
              pending.current = id;
              setIds([...ids, id]);
              setValue({ ...value, fields: [...value.fields, { title: "", value: "", secret }] });
            }}
          />
          <footer className="vault-footer">
            <Button type="button" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="primary">
              {t("credential.save")}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
