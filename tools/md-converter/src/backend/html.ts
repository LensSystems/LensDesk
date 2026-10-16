import TurndownService from "turndown";
import { addTurndownRules } from "./turndown-rules.ts";

export function convertHtml(html: string): { markdown: string; imageCount: number } {
  const service = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  const { imageCount } = addTurndownRules(service);
  return { markdown: service.turndown(html).trim(), imageCount: imageCount() };
}
