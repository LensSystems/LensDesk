import { createToolClient } from "@lensdesk/sdk";
import { Button, Panel } from "@lensdesk/ui";
import i18n from "i18next";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { initReactI18next, useTranslation } from "react-i18next";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import "./styles.css";

const app = createToolClient();

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: "es",
  fallbackLng: "es",
  interpolation: { escapeValue: false },
});

function App() {
  const { t } = useTranslation();
  const [context, setContext] = useState({
    locale: "es",
    theme: "dark",
    hostVersion: "",
    toolVersion: "",
  });
  const [count, setCount] = useState(0);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = t("title");
  }, [t]);

  useEffect(() => {
    let alive = true;
    const applyContext = (next: typeof context) => {
      setContext(next);
      document.documentElement.dataset.theme = next.theme;
      document.documentElement.lang = next.locale;
      void i18n.changeLanguage(next.locale);
    };
    void app.app
      .getContext()
      .then(applyContext)
      .catch((error: unknown) => {
        if (alive) setResult(i18n.t("errors.generic", { code: errorCode(error) }));
      });
    const unsubscribe = app.app.onContextChange(applyContext);
    void app.storage
      .get("count")
      .then((value) => {
        if (alive && typeof value === "number") setCount(value);
      })
      .catch((error: unknown) => {
        if (alive) setResult(i18n.t("errors.generic", { code: errorCode(error) }));
      });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const increment = async () => {
    const next = count + 1;
    setCount(next);
    try {
      await app.storage.set("count", next);
      setResult("");
    } catch (error) {
      setResult(t("errors.generic", { code: errorCode(error) }));
    }
  };

  const ping = async () => {
    setBusy(true);
    try {
      const response = await app.backend.invoke<{ pong: boolean; at: string }>("ping");
      setResult(`${response.pong ? t("pingSuccess") : ""} ${response.at}`.trim());
    } catch (error) {
      setResult(t("errors.generic", { code: errorCode(error) }));
    } finally {
      setBusy(false);
    }
  };

  const openFile = async () => {
    try {
      const [file] = await app.files.pickOpen({ multiple: false });
      if (!file) return;
      setResult(await app.files.readText(file.token));
    } catch (error) {
      setResult(t("errors.generic", { code: errorCode(error) }));
    }
  };

  return (
    <main className="template-page grid gap-4">
      <header>
        <h1 className="mb-1 text-[15px] font-semibold">{t("title")}</h1>
        <p className="text-muted">
          {t("context", { locale: context.locale, theme: context.theme })}
        </p>
      </header>
      <Panel aria-label={t("actionsHeading")} className="grid gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span>{t("counter", { count })}</span>
          <Button type="button" aria-label={t("incrementButton")} onClick={increment}>
            {t("incrementButton")}
          </Button>
        </div>
        <Button type="button" aria-label={t("pingButton")} disabled={busy} onClick={ping}>
          {t("pingButton")}
        </Button>
        <Button type="button" aria-label={t("openFileButton")} onClick={openFile}>
          {t("openFileButton")}
        </Button>
      </Panel>
      {result && (
        <Panel className="p-2">
          <output aria-live="polite" className="block whitespace-pre-wrap wrap-anywhere">
            {result}
          </output>
        </Panel>
      )}
    </main>
  );
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "E_INTERNAL";
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
