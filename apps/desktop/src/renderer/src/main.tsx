import type React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { useTranslation } from "react-i18next";
import { applyContext } from "./apply-context.ts";
import { rendererI18n } from "./i18n.ts";

function App(): React.JSX.Element {
  const { t } = useTranslation(undefined, { i18n: rendererI18n });
  return <main aria-label={t("shell.label")} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el elemento raíz");
createRoot(root).render(<App />);

const documentRoot = document.documentElement;
let contextEventReceived = false;
window.lensdeskHost.on("context.changed", (context) => {
  contextEventReceived = true;
  void rendererI18n.changeLanguage(context.locale);
  applyContext(context, documentRoot);
});
void window.lensdeskHost.invoke("app.getContext", {}).then((result) => {
  if (result.ok && !contextEventReceived) {
    void rendererI18n.changeLanguage(result.data.locale);
    applyContext(result.data, documentRoot);
  }
});
