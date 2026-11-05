import { promises as fs } from "node:fs";
import path from "node:path";
import { OFFICIAL_TOOLS_REPOSITORY } from "../catalog/contract.ts";
import { generateKeyPair } from "../keys.ts";
import { packTool } from "../pack.ts";
import {
  prepareToolRelease,
  releaseSha256,
  type ToolReleaseFile,
} from "../publishing/artifacts.ts";
import { fixtureTool, temporaryTools } from "../publishing/test-fixtures.ts";
import { bootstrapManifestSchema } from "./bootstrap.ts";
import type { CatalogRemoteAsset, CatalogRemoteRelease, ToolCatalogSource } from "./source.ts";

export async function catalogFixture() {
  const root = await fs.realpath(await temporaryTools());
  const keys = generateKeyPair();
  const releases: CatalogRemoteRelease[] = [];
  const assets = new Map<number, CatalogRemoteAsset[]>();
  const bytes = new Map<number, Uint8Array>();
  let nextId = 1;
  function addRelease(tag: string, files: ToolReleaseFile[], extra = {}) {
    const release: CatalogRemoteRelease = {
      id: nextId++,
      tag_name: tag,
      draft: false,
      prerelease: false,
      ...extra,
    };
    releases.push(release);
    assets.set(
      release.id,
      files.map((file) => {
        const asset: CatalogRemoteAsset = {
          id: nextId++,
          name: file.name,
          size: file.bytes.length,
          state: "uploaded",
          browser_download_url: `https://github.com/${OFFICIAL_TOOLS_REPOSITORY}/releases/download/${tag}/${file.name}`,
        };
        bytes.set(asset.id, file.bytes);
        return asset;
      }),
    );
    return release;
  }
  const bootstrapFiles: ToolReleaseFile[] = [];
  for (const id of ["notes", "md-converter"]) {
    const tool = await fixtureTool(root, `legacy-${id}`, id, "0.4.0");
    const file = path.join(root, `${id}-0.4.0.lenspkg`);
    await packTool(path.join(tool.directory, "dist"), {
      outFile: file,
      signing: { privateKeyPem: keys.privateKeyPem, keyId: "release" },
      reproducible: true,
    });
    bootstrapFiles.push({ name: path.basename(file), bytes: await fs.readFile(file) });
  }
  const bootstrapManifest = bootstrapManifestSchema.parse(
    bootstrapFiles.map((file) => ({
      id: file.name.replace("-0.4.0.lenspkg", ""),
      name: file.name,
      url: `https://github.com/${OFFICIAL_TOOLS_REPOSITORY}/releases/download/v0.4.0/${file.name}`,
      size: file.bytes.length,
      sha256: releaseSha256(file.bytes),
    })),
  );
  const sums = bootstrapFiles
    .map((file) => `${releaseSha256(file.bytes)}  ${file.name}`)
    .join("\n");
  bootstrapFiles.push({ name: "SHA256SUMS.txt", bytes: new TextEncoder().encode(`${sums}\n`) });
  const bootstrap = addRelease("v0.4.0", bootstrapFiles);
  async function addTool(id: string, version: string, minHostVersion = "0.1.0") {
    const folder = `source-${id}-${version.replaceAll(".", "-")}`;
    const tool = await fixtureTool(root, folder, id, version);
    tool.manifest.minHostVersion = minHostVersion;
    await fs.writeFile(
      path.join(tool.directory, "dist/lensdesk.tool.json"),
      JSON.stringify(tool.manifest),
    );
    const source = { ...tool, tag: `${id}-v${version}`, relativeDirectory: `tools/${folder}` };
    const bundle = await prepareToolRelease(source, path.join(root, `out-${folder}`), keys);
    return { release: addRelease(source.tag, bundle.files), bundle };
  }
  const source: ToolCatalogSource = {
    async releases(page) {
      return releases.slice((page - 1) * 100, page * 100);
    },
    async assets(id, page) {
      return (assets.get(id) ?? []).slice((page - 1) * 100, page * 100);
    },
    async download(asset) {
      const value = bytes.get(asset.id);
      if (!value) throw Error("Missing fixture bytes");
      return value;
    },
  };
  function replaceAsset(asset: CatalogRemoteAsset, value: Uint8Array) {
    bytes.set(asset.id, value);
    asset.size = value.length;
  }
  return {
    root,
    keys,
    source,
    releases,
    assets,
    bytes,
    bootstrap,
    bootstrapManifest,
    addTool,
    addRelease,
    replaceAsset,
  };
}
