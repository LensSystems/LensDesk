import { createRoot } from "react-dom/client";
import "./styles.css";
import { I18nextProvider } from "react-i18next";
import { rendererI18n } from "./i18n.ts";
import { App } from "./shell/App.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el elemento raíz");
createRoot(root).render(
  <I18nextProvider i18n={rendererI18n}>
    <App />
  </I18nextProvider>,
);
