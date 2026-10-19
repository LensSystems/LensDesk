import { UiLabelsProvider } from "@lensdesk/ui";
import { ThemeGallery } from "./ThemeGallery.tsx";

export function Gallery() {
  return (
    <UiLabelsProvider labels={{ loading: "Cargando", close: "Cerrar", dismiss: "Descartar" }}>
      <header>
        <h1>Galería de componentes</h1>
        <p>Comparación de temas y estados. Los controles son interactivos.</p>
      </header>
      <main className="gallery-columns">
        <ThemeGallery theme="light" />
        <ThemeGallery theme="dark" />
      </main>
    </UiLabelsProvider>
  );
}
