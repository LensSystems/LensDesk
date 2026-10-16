import type TurndownService from "turndown";
import { toGfmTable } from "./gfm-table.ts";

export function addTurndownRules(service: TurndownService): { imageCount: () => number } {
  let images = 0;
  service.addRule("gfmTable", {
    filter: "table",
    replacement: (_content, node) => {
      const rows = Array.from(node.querySelectorAll("tr")).map((row) =>
        Array.from(row.querySelectorAll("th, td")).map((cell) => (cell.textContent ?? "").trim()),
      );
      return rows.length ? `\n\n${toGfmTable(rows)}\n\n` : "";
    },
  });
  service.addRule("strikethrough", {
    // `strike` no figura en los tipos del DOM, por eso se compara el nombre del nodo.
    filter: (node) => ["DEL", "S", "STRIKE"].includes(node.nodeName),
    replacement: (content) => (content.trim() ? `~~${content.trim()}~~` : ""),
  });
  service.addRule("taskListItem", {
    filter: (node) => node.nodeName === "LI" && node.querySelector("input[type=checkbox]") !== null,
    replacement: (content, node) => {
      const checked = node.querySelector("input[type=checkbox]")?.hasAttribute("checked");
      const text = content.replace(/^\s+|\s+$/g, "").replace(/\n/g, "\n  ");
      return `\n${checked ? "- [x]" : "- [ ]"} ${text}\n`;
    },
  });
  service.addRule("omitImages", {
    filter: "img",
    replacement: () => {
      images += 1;
      return "";
    },
  });
  return { imageCount: () => images };
}
