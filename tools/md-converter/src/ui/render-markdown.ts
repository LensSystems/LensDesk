import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({ html: true, linkify: true });

// El saneado conserva solo imágenes locales.
export function renderMarkdown(source: string): string {
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if (
      node.nodeName === "IMG" &&
      data.attrName === "src" &&
      !data.attrValue.toLowerCase().startsWith("data:")
    )
      data.keepAttr = false;
  });
  try {
    return DOMPurify.sanitize(markdown.render(source));
  } finally {
    DOMPurify.removeHook("uponSanitizeAttribute");
  }
}
