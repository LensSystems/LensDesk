import { useTranslation } from "react-i18next";
import type { BankSnapshot } from "../shared/trading-contracts.ts";
export function BankDetails({ bank }: { bank: BankSnapshot | null }) {
  const { t } = useTranslation();
  return (
    <section className="ventas-bank-details">
      <h3>{t("transferDetails")}</h3>
      {bank ? (
        <>
          <p>
            {t("bank")}: {bank.bank}
          </p>
          <p>
            {t("holder")}: {bank.holder}
          </p>
          <p>
            {t("clabe")}: {bank.clabe}
          </p>
        </>
      ) : (
        <p>{t("noHistoricalBank")}</p>
      )}
    </section>
  );
}
