import type React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { applyContext } from "./apply-context.ts";

function App(): React.JSX.Element {
  return <main aria-label="LensDesk" />;
}

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el elemento raíz");
createRoot(root).render(<App />);

const documentRoot = document.documentElement;
let contextEventReceived = false;
window.lensdeskHost.on("context.changed", (context) => {
  contextEventReceived = true;
  applyContext(context, documentRoot);
});
void window.lensdeskHost.invoke("app.getContext", {}).then((result) => {
  if (result.ok && !contextEventReceived) applyContext(result.data, documentRoot);
});
