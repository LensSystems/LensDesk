import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ToolManifest } from "@lensdesk/sdk";

export async function temporaryTools(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lensdesk-tool-release-"));
  await fs.mkdir(path.join(root, "tools"));
  return root;
}
export async function fixtureTool(root: string, folder: string, id = folder, version = "1.2.3") {
  const directory = path.join(root, "tools", folder);
  const manifest: ToolManifest = {
    id,
    version,
    apiVersion: 1,
    minHostVersion: "0.1.0",
    name: { es: "Ejemplo", en: "Example" },
    description: { es: "Herramienta local", en: "Local tool" },
    icon: "file",
    permissions: [],
    ui: { entry: "ui/index.html" },
  };
  await fs.mkdir(path.join(directory, "dist/ui"), { recursive: true });
  for (const file of ["lensdesk.tool.json", "dist/lensdesk.tool.json"])
    await fs.writeFile(path.join(directory, file), JSON.stringify(manifest));
  await fs.writeFile(path.join(directory, "package.json"), JSON.stringify({ version }));
  await fs.writeFile(path.join(directory, "dist/ui/index.html"), "<h1>Ejemplo</h1>");
  return { directory, manifest };
}
