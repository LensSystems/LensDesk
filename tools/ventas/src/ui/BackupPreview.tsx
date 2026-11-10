import { useTranslation } from "react-i18next";
import type { PreparedBackup } from "../shared/backup-contracts.ts";
import { dateText } from "./format.ts";
export function BackupPreview({ preview: p }: { preview: PreparedBackup }) {
  const { t, i18n } = useTranslation();
  const money = (c: string) => {
    const n = BigInt(c),
      format = new Intl.NumberFormat(i18n.language.startsWith("es") ? "es-MX" : "en-US", {
        style: "currency",
        currency: "MXN",
      });
    return format
      .formatToParts(n / 100n)
      .map((part) => (part.type === "fraction" ? String(n % 100n).padStart(2, "0") : part.value))
      .join("");
  };
  return (
    <div className="grid gap-3">
      <strong>{p.name}</strong>
      <p>
        {t("backupFormat", { format: p.format === "web1" ? "Web 1" : "Nativo 1" })} ·{" "}
        {dateText(p.createdAt.slice(0, 10), i18n.language)}
      </p>
      <dl className="ventas-confirm-summary">
        {(["products", "clients", "sales", "payments", "returns", "cash_sessions"] as const).map(
          (k) => (
            <div key={k}>
              <dt>{t(`backupCounts.${k}`)}</dt>
              <dd>{p.counts[k] ?? 0}</dd>
            </div>
          ),
        )}
        <div>
          <dt>{t("accountBalance")}</dt>
          <dd>{money(p.balance)}</dd>
        </div>
        <div>
          <dt>{t("inventoryValue")}</dt>
          <dd>{money(p.stockValue)}</dd>
        </div>
      </dl>
      {p.limitations.length ? (
        <section>
          <h3>{t("backupLimitations")}</h3>
          <ul>
            {p.limitations.map((k) => (
              <li key={k}>
                {t(`backupMissing.${k}`, { defaultValue: t("historicalUnavailable") })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
