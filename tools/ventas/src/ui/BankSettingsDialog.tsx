import { Input } from "@lensdesk/ui";
import { Landmark } from "lucide-react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { Settings } from "../shared/values.ts";
import { SettingsDialog } from "./SettingsDialog.tsx";
import type { ScreenProps } from "./types.ts";

export function BankSettingsDialog({
  bank,
  disabled = false,
  triggerRef,
  onLimitCreated,
  onUnavailableTriggerFocus,
  ...props
}: ScreenProps & {
  bank?: Settings["banks"][number];
  disabled?: boolean;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  onLimitCreated?: (id: string) => void;
  onUnavailableTriggerFocus?: () => boolean;
}) {
  const { t } = useTranslation();
  const fields = ["alias", "bank", "holder", "clabe"] as const;
  return (
    <SettingsDialog
      {...props}
      disabled={disabled}
      triggerRef={triggerRef}
      onUnavailableTriggerFocus={onUnavailableTriggerFocus}
      title={t(bank ? "editBank" : "addBank")}
      icon={Landmark}
      trigger={t(bank ? "editBank" : "addBank")}
      description={t("bankAliasIntro")}
      confirm={t("saveBank")}
      onSubmit={(form, id) => {
        const next = {
          ...bank,
          id: bank?.id ?? id,
          bank: String(form.get("bank")),
          holder: String(form.get("holder")),
          clabe: String(form.get("clabe")),
          alias: String(form.get("alias")),
        };
        if (!bank && props.data.settings.banks.length === 19) onLimitCreated?.(next.id);
        const banks = bank
          ? props.data.settings.banks.map((b) => (b.id === bank.id ? next : b))
          : [...props.data.settings.banks, next];
        return {
          ...props.data.settings,
          banks,
        };
      }}
    >
      {fields.map((key) => (
        <Input
          key={key}
          name={key}
          label={t(key === "alias" ? "bankAlias" : key)}
          defaultValue={bank?.[key] ?? ""}
          required={key !== "alias"}
          maxLength={key === "clabe" ? 18 : 120}
          pattern={key === "clabe" ? "[0-9]{18}" : key === "alias" ? undefined : ".*\\S.*"}
          inputMode={key === "clabe" ? "numeric" : undefined}
        />
      ))}
    </SettingsDialog>
  );
}
