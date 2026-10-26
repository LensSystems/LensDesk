import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";

import { type CredentialPreview, credentialCard } from "./credential-preview.ts";

import { copyIcon } from "./preview-controls.ts";

const markdown = new MarkdownIt({ html: true, linkify: true, breaks: true });

// Marca de los botones de copiar que genera la vista previa. El HTML de una nota no la conoce,
// así que no puede imitar un botón que copie otro texto.
export const COPY_CODE_TOKEN = crypto.randomUUID();

markdown.core.ruler.after("inline", "code_caption", (state) => {
  for (let index = 0; index < state.tokens.length; index++) {
    const block = state.tokens[index];
    if (block?.type !== "fence") continue;
    if (block.info.trim() === "credential" && state.env.credentials) continue;
    const [open, inline, close] = state.tokens.slice(index + 1, index + 4);
    const children = inline?.children;
    if (
      open?.type !== "paragraph_open" ||
      inline?.type !== "inline" ||
      close?.type !== "paragraph_close" ||
      !block.map ||
      open.map?.[0] !== block.map[1] ||
      !/^([*_])[^\n]+\1$/.test(inline.content) ||
      children?.[0]?.type !== "em_open" ||
      children.at(-1)?.type !== "em_close" ||
      children.slice(1, -1).some((token) => token.type === "em_close")
    )
      continue;
    block.meta = {
      caption: state.md.renderer.renderInline(children.slice(1, -1), state.md.options, state.env),
    };
    state.tokens.splice(index + 1, 3);
  }
});

for (const type of ["fence", "code_block"]) {
  const original = markdown.renderer.rules[type];
  markdown.renderer.rules[type] = (tokens, index, options, env, renderer) => {
    if (type === "fence" && tokens[index]?.info.trim() === "credential" && env?.credentials)
      return credentialCard(
        tokens[index]?.content ?? "",
        env.credentials as CredentialPreview,
        markdown.utils.escapeHtml,
      );
    const code = original?.(tokens, index, options, env, renderer) ?? "";
    const label = markdown.utils.escapeHtml(typeof env?.copyCode === "string" ? env.copyCode : "");
    const caption = tokens[index]?.meta?.caption;
    const language = markdown.utils.escapeHtml(tokens[index]?.info.trim().split(/\s+/)[0] ?? "");
    return `<figure class="ld-code-block"><div class="ld-code-header"><span>${language}</span><button type="button" aria-label="${label}" title="${label}" data-copy-code="${COPY_CODE_TOKEN}">${copyIcon}</button></div>${code}${
      typeof caption === "string" ? `<figcaption>${caption}</figcaption>` : ""
    }</figure>\n`;
  };
}

export function renderPreview(
  source: string,
  copyCode = "",
  credentials?: CredentialPreview,
): string {
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if (
      node.nodeName === "IMG" &&
      data.attrName === "src" &&
      !data.attrValue.toLowerCase().startsWith("data:")
    )
      data.keepAttr = false;
  });
  try {
    return DOMPurify.sanitize(markdown.render(source, { copyCode, credentials }), {
      ADD_TAGS: ["figure", "figcaption", "button"],
      ADD_ATTR: ["data-copy-code"],
    });
  } finally {
    DOMPurify.removeHook("uponSanitizeAttribute");
  }
}
