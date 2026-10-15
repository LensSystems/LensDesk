import type React from "react";
import { createRoot } from "react-dom/client";

function App(): React.JSX.Element {
  return <main aria-label="LensDesk" />;
}

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el elemento raíz");
createRoot(root).render(<App />);
