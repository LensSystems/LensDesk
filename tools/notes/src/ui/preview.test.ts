import { expect, it } from "vitest";
import { renderPreview } from "./preview.ts";

function preview(source: string, label = "Copiar código") {
  const host = document.createElement("div");
  host.innerHTML = renderPreview(source, label);
  return host;
}

it.each(["*Comentario con **énfasis***", "_Comentario con **énfasis**_"])(
  "convierte el comentario inmediato %s en un pie del bloque",
  (caption) => {
    const host = preview(`\`\`\`ts\nconst x = 1;\n\`\`\`\n${caption}\n`);
    const figure = host.querySelector("figure.ld-code-block");
    expect(
      figure?.querySelector('button[type="button"][data-copy-code]')?.getAttribute("aria-label"),
    ).toBe("Copiar código");
    expect(figure?.querySelector("code")?.textContent).toBe("const x = 1;\n");
    expect(figure?.querySelector("figcaption")?.textContent).toBe("Comentario con énfasis");
    expect(host.querySelector("p")).toBeNull();
  },
);

it.each(["", "\n*Separado*", "Texto *parcial*", "*Primera* y *segunda*", "*Dos\nlíneas*"])(
  "no crea pie para %s",
  (suffix) => {
    const host = preview(`\`\`\`\ncódigo\n\`\`\`\n${suffix}`);
    expect(host.querySelector("figcaption")).toBeNull();
    if (suffix) expect(host.querySelector("p")).not.toBeNull();
  },
);

it("envuelve también los bloques indentados sin confundir código y etiquetas", () => {
  const host = preview("    <button>código</button>\n", 'Copy <code> & "text"');
  expect(host.querySelector("figure pre code")?.textContent).toBe("<button>código</button>\n");
  expect(host.querySelector("button")?.getAttribute("aria-label")).toBe('Copy <code> & "text"');
  expect(host.querySelectorAll("button")).toHaveLength(1);
});

it("conserva los controles y sanea scripts, eventos y URL peligrosas", () => {
  const host = preview(
    '```\nx\n```\n*Pie <img src="x" onerror="alert(1)">*\n\n<script>alert(1)</script>\n<button data-copy-code onclick="alert(1)">Otro</button>\n<a href="javascript:alert(1)">enlace</a>',
  );
  expect(host.querySelector("figure button[data-copy-code]")).not.toBeNull();
  expect(host.querySelector("figcaption")?.textContent).toBe("Pie ");
  expect(host.querySelector("script, [onclick], [onerror], [href], img[src]")).toBeNull();
});
