import { Link } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { Format } from "./markdown-commands.ts";

const glyphClass: Record<Exclude<Format, "link">, string> = {
  bold: "text-[13px] font-extrabold",
  italic: "[font-family:serif] text-[13px] font-normal italic",
  underline: "text-[13px] font-normal underline",
  strike: "text-[13px] font-normal line-through",
  code: "font-mono text-[11px] font-normal",
};

export function FormatGlyph({ format }: { format: Format }) {
  const { t } = useTranslation();
  if (format === "link") return <Link className="size-3.5" />;
  return <span className={glyphClass[format]}>{t(`formatGlyphs.${format}`)}</span>;
}
