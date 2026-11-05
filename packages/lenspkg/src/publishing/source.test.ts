import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertToolReleaseEnvironment, parseToolReleaseTag, resolveToolRelease } from "./source.ts";
import { fixtureTool, temporaryTools } from "./test-fixtures.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});
async function root() {
  const value = await temporaryTools();
  roots.push(value);
  return value;
}

describe("fuente de una publicación independiente", () => {
  it.each(["notes", "md-converter", "viewer", "v1-tool"])(
    "resuelve %s por manifiesto y no por lista fija",
    async (id) => {
      const directory = await root();
      await fixtureTool(directory, "generic-folder", id);
      const source = await resolveToolRelease(directory, `${id}-v1.2.3`);
      expect(source.relativeDirectory).toBe("tools/generic-folder");
      expect(source.manifest.id).toBe(id);
    },
  );

  it("reserva las dos versiones bootstrap sin limitar herramientas nuevas en 0.4.0", async () => {
    for (const id of ["notes", "md-converter"]) {
      const directory = await root();
      await fixtureTool(directory, id, id, "0.4.0");
      await expect(resolveToolRelease(directory, `${id}-v0.4.0`)).rejects.toThrow(/reserved/);
    }
    const directory = await root();
    await fixtureTool(directory, "new-tool", "new-tool", "0.4.0");
    expect((await resolveToolRelease(directory, "new-tool-v0.4.0")).manifest.id).toBe("new-tool");
  });

  it.each([
    "notes-v01.2.3",
    "notes-v1.2.3-beta",
    "notes-v1.2.3+build",
    "../notes-v1.2.3",
    "notes-v1.2.3\n",
    "$(id)-v1.2.3",
    "notes-v1.2.3;id",
    "v1.2.3",
    "notes-v1.2.3/extra",
  ])("rechaza tag no válido %j", (tag) => {
    expect(() => parseToolReleaseTag(tag)).toThrow();
  });

  it("excluye template, rechaza discrepancias de versión e IDs duplicados", async () => {
    const directory = await root();
    await fixtureTool(directory, "_template", "template");
    await expect(resolveToolRelease(directory, "template-v1.2.3")).rejects.toThrow();
    await fixtureTool(directory, "notes");
    await expect(resolveToolRelease(directory, "notes-v1.2.4")).rejects.toThrow();
    await fixtureTool(directory, "another-folder", "notes");
    await expect(resolveToolRelease(directory, "notes-v1.2.3")).rejects.toThrow(/Duplicate/);
  });

  it("requiere versión package igual y API soportada", async () => {
    const directory = await root();
    const { directory: tool, manifest } = await fixtureTool(directory, "notes");
    await fs.writeFile(path.join(tool, "package.json"), '{"version":"1.2.4"}');
    await expect(resolveToolRelease(directory, "notes-v1.2.3")).rejects.toThrow();
    await fs.writeFile(path.join(tool, "package.json"), '{"version":"1.2.3"}');
    await fs.writeFile(
      path.join(tool, "lensdesk.tool.json"),
      JSON.stringify({ ...manifest, apiVersion: 2 }),
    );
    await expect(resolveToolRelease(directory, "notes-v1.2.3")).rejects.toThrow();
  });

  it("rechaza metadatos enlazados fuera del árbol", async () => {
    const directory = await root();
    const { directory: tool } = await fixtureTool(directory, "notes");
    const manifest = path.join(tool, "lensdesk.tool.json");
    const outside = path.join(directory, "outside.json");
    await fs.rename(manifest, outside);
    await fs.symlink(outside, manifest, "file");
    await expect(resolveToolRelease(directory, "notes-v1.2.3")).rejects.toThrow(/symlink/);
  });

  it("comprueba ambiente oficial, commit del tag y pertenencia a main sin shell", () => {
    const commit = "a".repeat(40);
    const env = {
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: "LensSystems/LensDesk",
      GITHUB_REF_TYPE: "tag",
      GITHUB_REF_NAME: "notes-v1.2.3",
      GITHUB_SHA: commit,
    };
    const git = vi.fn().mockReturnValueOnce(commit).mockReturnValue("");
    expect(assertToolReleaseEnvironment(env, git)).toEqual({ tag: env.GITHUB_REF_NAME, commit });
    expect(git.mock.calls).toEqual([
      [["rev-parse", "--verify", "refs/tags/notes-v1.2.3^{commit}"]],
      [["merge-base", "--is-ancestor", commit, "refs/remotes/origin/main"]],
    ]);
    expect(() =>
      assertToolReleaseEnvironment({ ...env, GITHUB_REPOSITORY: "fork/repo" }, git),
    ).toThrow();
    expect(() => assertToolReleaseEnvironment(env, () => "b".repeat(40))).toThrow();
    const notIntegrated = vi
      .fn()
      .mockReturnValueOnce(commit)
      .mockImplementation(() => {
        throw Error("not ancestor");
      });
    expect(() => assertToolReleaseEnvironment(env, notIntegrated)).toThrow();
  });
});
