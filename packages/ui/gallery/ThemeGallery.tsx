import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TooltipProvider,
} from "@lensdesk/ui";
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
      <div className="mb-4 flex items-center gap-2">
        <span>Acento</span>
        <Select
          value={accent}
          onValueChange={(value) => setAccent(value === "green" ? "green" : "blue")}
        >
          <SelectTrigger aria-label={`Acento del tema ${theme}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="blue">Azul</SelectItem>
            <SelectItem value="green">Verde</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <TooltipProvider>
        <ControlExamples />
        <SelectionExamples />
        <OverlayExamples />
        <SharedExamples />
      </TooltipProvider>
    </article>
  );
}
