import type { createToolClient } from "@lensdesk/sdk";
import { Puzzle } from "@lensdesk/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionRow } from "./ActionRow.tsx";
import { ActionsCard } from "./ActionsCard.tsx";

type Client = ReturnType<typeof createToolClient>;
type Result = { message: string; error: boolean };

export function App({ client }: { client: Client }) {
  const { t, i18n } = useTranslation();
  const [context, setContext] = useState({
    locale: "es",
    theme: "dark",
    hostVersion: "",
    toolVersion: "",
  });
  const [count, setCount] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const fail = (error: unknown) =>
    setResult({ message: i18n.t("errors.generic", { code: errorCode(error) }), error: true });

  useEffect(() => {
    document.title = t("title");
  }, [t]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Se suscribe una sola vez al montar.
  useEffect(() => {
    let alive = true;
    const applyContext = (next: typeof context) => {
      setContext(next);
      document.documentElement.dataset.theme = next.theme;
      document.documentElement.lang = next.locale;
      void i18n.changeLanguage(next.locale);
    };
    void client.app
      .getContext()
      .then(applyContext)
      .catch((error: unknown) => {
        if (alive) fail(error);
      });
    const unsubscribe = client.app.onContextChange(applyContext);
    void client.storage
      .get("count")
      .then((value) => {
        if (alive && typeof value === "number") setCount(value);
      })
      .catch((error: unknown) => {
        if (alive) fail(error);
      });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [client]);

  const increment = async () => {
    const next = count + 1;
    setCount(next);
    try {
      await client.storage.set("count", next);
      setResult(null);
    } catch (error) {
      fail(error);
    }
  };

  const ping = async () => {
    setBusy(true);
    try {
      const response = await client.backend.invoke<{ pong: boolean; at: string }>("ping");
      const message = `${response.pong ? t("pingSuccess") : ""} ${response.at}`.trim();
      setResult({ message, error: false });
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const openFile = async () => {
    try {
      const [file] = await client.files.pickOpen({ multiple: false });
      if (!file) return;
      setResult({ message: await client.files.readText(file.token), error: false });
    } catch (error) {
      fail(error);
    }
  };

  return (
    <main className="flex h-screen flex-col p-3 pt-0">
      <div className="min-h-0 flex-1 overflow-auto rounded-ld-lg border border-border bg-surface">
        <div className="mx-auto flex w-full max-w-160 flex-col gap-6 p-8">
          <header className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-ld-md bg-accent-soft text-accent-soft-fg"
            >
              <Puzzle size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold">{t("title")}</h1>
              <p className="text-[13px] text-muted">
                {t("context", { locale: context.locale, theme: context.theme })}
              </p>
            </div>
          </header>
          <ActionsCard>
            <ActionRow
              label={t("counter", { count })}
              description={t("storageDescription")}
              buttonLabel={t("incrementButton")}
              onClick={increment}
            />
            <ActionRow
              label={t("backendLabel")}
              description={t("backendDescription")}
              buttonLabel={t("pingButton")}
              disabled={busy}
              onClick={ping}
            />
            <ActionRow
              label={t("filesLabel")}
              description={t("filesDescription")}
              buttonLabel={t("openFileButton")}
              onClick={openFile}
            />
          </ActionsCard>
          {result?.message && (
            <output
              aria-live="polite"
              className={`block rounded-ld-md border border-border px-4 py-3 font-mono text-[13px] whitespace-pre-wrap wrap-anywhere ${result.error ? "bg-danger-soft text-danger" : "bg-bg"}`}
            >
              {result.message}
            </output>
          )}
        </div>
      </div>
    </main>
  );
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "E_INTERNAL";
}
