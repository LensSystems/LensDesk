function limitTitle(title: string): string {
  const shortened = title.slice(0, 200);
  return /[\uD800-\uDBFF]$/.test(shortened) ? shortened.slice(0, -1) : shortened;
}

// Solo un `# Título` en la primera línea no vacía pasa a ser el título (es lo que escribe la
// exportación). Cualquier otro caso conserva el cuerpo intacto y usa el nombre del archivo.
export function importMarkdown(body: string, filename: string) {
  const lines = body.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const first = lines.findIndex((line) => line.trim() !== "");
  const heading = /^ {0,3}#[ \t]+(.*)$/.exec(lines[first]?.replace(/\r?\n$/, "") ?? "");
  if (heading) {
    const fullTitle = (heading[1] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim();
    const title = limitTitle(fullTitle);
    // Un título demasiado largo se recorta y el encabezado completo se queda en el cuerpo.
    if (title !== fullTitle) return { title, body_md: body };
    const skip = lines[first + 1]?.trim() === "" ? 2 : 1;
    return { title, body_md: [...lines.slice(0, first), ...lines.slice(first + skip)].join("") };
  }
  return { title: limitTitle(filename.replace(/\.[^.]+$/, "")), body_md: body };
}

export function exportMarkdown(title: string, body: string): string {
  // Un título que acaba en « #…» se leería como cierre del encabezado: se añade uno explícito.
  const closing = /[ \t]#+[ \t]*$/.test(title) ? " #" : "";
  return `# ${title}${closing}\n\n${body}`;
}
