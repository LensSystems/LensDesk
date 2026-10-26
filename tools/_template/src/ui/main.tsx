import { createToolClient } from "@lensdesk/sdk";
import { trackInputModality } from "@lensdesk/ui";
import i18n from "i18next";
import { createRoot } from "react-dom/client";
import { initReactI18next } from "react-i18next";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { App } from "./App.tsx";
import "./styles.css";

const app = createToolClient();

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: "es",
  fallbackLng: "es",
  interpolation: { escapeValue: false },
});

trackInputModality();
const root = document.getElementById("root");
if (root) createRoot(root).render(<App client={app} />);
