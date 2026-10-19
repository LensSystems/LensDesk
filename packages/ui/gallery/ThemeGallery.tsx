import { TooltipProvider } from "@lensdesk/ui";
import { ControlExamples } from "./ControlExamples.tsx";
import { OverlayExamples } from "./OverlayExamples.tsx";
import { SelectionExamples } from "./SelectionExamples.tsx";
import { SharedExamples } from "./SharedExamples.tsx";

export function ThemeGallery({ theme }: { theme: "light" | "dark" }) {
  const activate = () => {
    document.documentElement.dataset.theme = theme;
  };
  return (
    <article
      data-theme={theme}
      onPointerDownCapture={activate}
      onPointerOverCapture={activate}
      onFocusCapture={activate}
    >
      <h2>Tema {theme === "light" ? "claro" : "oscuro"}</h2>
      <TooltipProvider>
        <ControlExamples />
        <SelectionExamples />
        <OverlayExamples />
        <SharedExamples />
      </TooltipProvider>
    </article>
  );
}
