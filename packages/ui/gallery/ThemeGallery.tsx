import { TooltipProvider } from "@lensdesk/ui";
import { useState } from "react";
import { ControlExamples } from "./ControlExamples.tsx";
import { OverlayExamples } from "./OverlayExamples.tsx";
import { SelectionExamples } from "./SelectionExamples.tsx";
import { SharedExamples } from "./SharedExamples.tsx";

export function ThemeGallery({ theme }: { theme: "light" | "dark" }) {
  const [accent, setAccent] = useState<"blue" | "green">("blue");
  const activate = () => {
    document.documentElement.dataset.accent = accent;
    document.documentElement.dataset.theme = theme;
  };
  return (
    <article
      data-theme={theme}
      data-accent={accent}
      onPointerDownCapture={activate}
      onPointerOverCapture={activate}
      onFocusCapture={activate}
    >
      <h2>Tema {theme === "light" ? "claro" : "oscuro"}</h2>
      <label>
        Acento
        <select
          value={accent}
          onChange={(event) => setAccent(event.target.value as "blue" | "green")}
        >
          <option value="blue">Azul</option>
          <option value="green">Verde</option>
        </select>
      </label>
      <TooltipProvider>
        <ControlExamples />
        <SelectionExamples />
        <OverlayExamples />
        <SharedExamples />
      </TooltipProvider>
    </article>
  );
}
