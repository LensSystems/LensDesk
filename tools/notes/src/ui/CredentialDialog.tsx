import { Button, Dialog, DialogContent, DialogTitle, Eye, Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Credential } from "./credential-block.ts";
export function CredentialDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: Credential;
  onSave: (value: Credential) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initial);
  const [shown, setShown] = useState(false);
  // Claves estables para los campos añadidos (los valores pueden repetirse).
  const [ids, setIds] = useState(() => initial.fields.map(() => crypto.randomUUID()));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        closeLabel={t("close")}
        aria-describedby={undefined}
        className="max-h-[90vh] overflow-auto"
      >
        <DialogTitle>{t("credential.title")}</DialogTitle>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(value);
          }}
        >
          <Input
            label={t("credential.user")}
            value={value.user}
            onChange={(e) => setValue({ ...value, user: e.target.value })}
          />
          <Input
            label={t("credential.password")}
            type={shown ? "text" : "password"}
            value={value.password}
            onChange={(e) => setValue({ ...value, password: e.target.value })}
          />
          <Button
            type="button"
            aria-label={t(shown ? "credential.hide" : "credential.show")}
            onClick={() => setShown(!shown)}
          >
            <Eye size={16} />
          </Button>
          <label>
            {t("credential.note")}
            <textarea
              className="w-full rounded-ld-sm border border-control bg-surface p-2"
              value={value.note}
              onChange={(e) => setValue({ ...value, note: e.target.value })}
            />
          </label>
          {value.fields.map((field, index) => (
            <div className="flex flex-col gap-2" key={ids[index]}>
              <Input
                label={t("credential.fieldTitle")}
                value={field.title}
                onChange={(e) =>
                  setValue({
                    ...value,
                    fields: value.fields.map((item, i) =>
                      i === index ? { ...item, title: e.target.value } : item,
                    ),
                  })
                }
              />
              <Input
                label={t(field.secret ? "credential.secret" : "credential.text")}
                type={field.secret ? "password" : "text"}
                value={field.value}
                onChange={(e) =>
                  setValue({
                    ...value,
                    fields: value.fields.map((item, i) =>
                      i === index ? { ...item, value: e.target.value } : item,
                    ),
                  })
                }
              />
            </div>
          ))}
          <fieldset>
            <legend>{t("credential.add")}</legend>
            {[false, true].map((secret) => (
              <Button
                key={String(secret)}
                type="button"
                onClick={() => {
                  setIds([...ids, crypto.randomUUID()]);
                  setValue({
                    ...value,
                    fields: [...value.fields, { title: "", value: "", secret }],
                  });
                }}
              >
                {t(secret ? "credential.secret" : "credential.text")}
              </Button>
            ))}
          </fieldset>
          <Button type="submit" variant="primary">
            {t("credential.save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
