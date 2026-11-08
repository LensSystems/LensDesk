import { Button, DialogTrigger, IconButton, TabsList, TabsTrigger } from "@lensdesk/ui";
import { Settings } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { Snapshot } from "../shared/contracts.ts";
import { dateText } from "./format.ts";
import { screens } from "./types.ts";

export function Navigation({ data, busy }: { data: Snapshot | null; busy: boolean }) {
  const countId = useId();
  const { t, i18n } = useTranslation();
  const overdue = data?.accounts.filter((account) => account.overdue > 0).length ?? 0;
  return (
    <header className="ventas-nav">
      <nav aria-label={t("navigation")}>
        <TabsList aria-label={t("navigation")} className="ventas-nav-tabs">
          {screens.map((key) =>
            key === "settings" ? (
              <TabsTrigger key={key} value={key} asChild className="ventas-nav-settings">
                <IconButton label={t("nav.settings")}>
                  <Settings size={17} aria-hidden="true" />
                </IconButton>
              </TabsTrigger>
            ) : (
              <TabsTrigger
                key={key}
                value={key}
                className="ventas-nav-tab"
                aria-label={t(`nav.${key}`)}
                aria-describedby={key === "accounts" ? countId : undefined}
              >
                {t(`nav.${key}`)}
                {key === "accounts" ? (
                  <>
                    <span className="ventas-nav-count" aria-hidden="true">
                      {overdue}
                    </span>
                    <span id={countId} className="sr-only">
                      {t("overdueAccounts", { count: overdue })}
                    </span>
                  </>
                ) : null}
              </TabsTrigger>
            ),
          )}
        </TabsList>
      </nav>
      <div className="ventas-nav-status">
        <span>{data ? dateText(data.today, i18n.language) : ""}</span>
        <DialogTrigger asChild>
          <Button disabled={busy || !data}>{t(data?.cash ? "cashOpen" : "openCash")}</Button>
        </DialogTrigger>
      </div>
    </header>
  );
}
