import { Button, Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Settings } from "../shared/contracts.ts";
import type { ScreenProps } from "./types.ts";

export function SettingsPage({ data, run, busy }: ScreenProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Settings>(() => structuredClone(data.settings));
  const change = (key: "name" | "address" | "phone" | "thanks", value: string) =>
    setSettings((s) => ({ ...s, [key]: value }));
  return (
    <section className="ventas-settings">
      <h1>{t("nav.settings")}</h1>
      <p className="text-muted">{t("settingsIntro")}</p>
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void run({ type: "saveSettings", settings });
        }}
      >
        <Input
          label={t("businessName")}
          value={settings.name}
          maxLength={120}
          onChange={(e) => change("name", e.target.value)}
        />
        <Input
          label={t("address")}
          value={settings.address}
          maxLength={300}
          onChange={(e) => change("address", e.target.value)}
        />
        <Input
          label={t("phone")}
          value={settings.phone}
          maxLength={40}
          onChange={(e) => change("phone", e.target.value)}
        />
        <Input
          label={t("thanks")}
          value={settings.thanks}
          maxLength={300}
          onChange={(e) => change("thanks", e.target.value)}
        />
        <h2>{t("bankAccounts")}</h2>
        {settings.banks.map((bank) => (
          <fieldset className="grid gap-3 rounded-ld-md border border-border p-4" key={bank.id}>
            <legend>{bank.bank || t("bank")}</legend>
            {(["bank", "holder", "clabe"] as const).map((field) => (
              <Input
                key={field}
                label={t(field)}
                value={bank[field]}
                required
                maxLength={field === "clabe" ? 18 : 120}
                pattern={field === "clabe" ? "[0-9]{18}" : undefined}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    banks: s.banks.map((b) =>
                      b.id === bank.id ? { ...b, [field]: e.target.value } : b,
                    ),
                  }))
                }
              />
            ))}
            <Button
              type="button"
              onClick={() =>
                setSettings((s) => ({ ...s, banks: s.banks.filter((b) => b.id !== bank.id) }))
              }
            >
              {t("removeBank")}
            </Button>
          </fieldset>
        ))}
        <Button
          type="button"
          disabled={settings.banks.length >= 20}
          onClick={() =>
            setSettings((s) => ({
              ...s,
              banks: [...s.banks, { id: crypto.randomUUID(), bank: "", holder: "", clabe: "" }],
            }))
          }
        >
          {t("addBank")}
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {t("saveSettings")}
        </Button>
      </form>
    </section>
  );
}
