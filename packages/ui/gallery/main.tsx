import { createRoot } from "react-dom/client";
import { Gallery } from "./Gallery.tsx";
import "./gallery.css";

const root = document.getElementById("root");
if (!root) throw new Error("Falta el contenedor de la galería");
createRoot(root).render(<Gallery />);
