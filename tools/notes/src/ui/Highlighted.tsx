import { Fragment } from "react";
import { searchHighlight } from "./search-highlight.ts";

export function Highlighted({ text, query }: { text: string; query: string }) {
  let offset = 0;
  return searchHighlight(text, query).map((span) => {
    const key = offset;
    offset += span.text.length;
    return span.match ? (
      <mark key={key} className="rounded-ld-sm bg-accent-soft px-0.5 text-accent-soft-fg">
        {span.text}
      </mark>
    ) : (
      <Fragment key={key}>{span.text}</Fragment>
    );
  });
}
