import { Input } from "@lensdesk/ui";
import { Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { normalizeSettings } from "../shared/values.ts";
import { SettingsDialog } from "./SettingsDialog.tsx";
import type { ScreenProps } from "./types.ts";

export function BusinessSettingsForm(props: ScreenProps) {
  const { t } = useTranslation();
  const settings = normalizeSettings(props.data.settings);
  const fields = ["name", "ownerName", "address", "phone", "rfc"] as const;
  const labels = {
    name: "businessName",
    ownerName: "ownerNameInput",
    address: "address",
    phone: "phone",
    rfc: "rfcOptional",
  };
  return (
    <SettingsDialog
      {...props}
      title={t("businessData")}
      icon={Store}
      description={t("businessDataIntro")}
      trigger={t("editBusiness")}
      confirm={t("saveBusinessData")}
      primary
      onSubmit={(form) => ({
        ...props.data.settings,
        ...Object.fromEntries(fields.map((key) => [key, String(form.get(key))])),
      })}
    >
      {fields.map((key) => (
        <Input
          key={key}
          name={key}
          label={t(labels[key])}
          defaultValue={settings[key]}
          required={key !== "rfc"}
          pattern={key !== "rfc" ? ".*\\S.*" : undefined}
          maxLength={key === "address" ? 300 : key === "phone" || key === "rfc" ? 40 : 120}
        />
      ))}
    </SettingsDialog>
  );
}
