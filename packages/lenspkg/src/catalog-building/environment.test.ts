import { describe, expect, it, vi } from "vitest";
import { assertCatalogBuildEnvironment } from "./environment.ts";

const commit = "a".repeat(40);
const base = {
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: "LensSystems/LensDesk",
  GITHUB_EVENT_NAME: "push",
  GITHUB_REF_TYPE: "tag",
  GITHUB_REF: "refs/tags/notes-v1.2.3",
  GITHUB_REF_NAME: "notes-v1.2.3",
  GITHUB_SHA: commit,
};
const git = () =>
  vi
    .fn<(args: string[]) => string>()
    .mockImplementation((args) => (args[0] === "merge-base" ? "" : commit));

describe("fuente main y ref del caller del catálogo", () => {
  it.each(["notes-v1.2.3", "v0.5.0", "v1-tool-v1.2.3"])(
    "acepta tag canónico integrado %s sin permitir inicialización",
    (tag) => {
      const command = git();
      expect(
        assertCatalogBuildEnvironment(
          { ...base, GITHUB_REF_NAME: tag, GITHUB_REF: `refs/tags/${tag}` },
          command,
        ),
      ).toEqual({ manualInitialization: false, expectedReleaseTag: tag });
      expect(command).toHaveBeenCalledWith([
        "merge-base",
        "--is-ancestor",
        commit,
        "refs/remotes/origin/main",
      ]);
    },
  );
  it("permite inicialización solo en dispatch de main con builder actual", () => {
    expect(
      assertCatalogBuildEnvironment(
        {
          ...base,
          GITHUB_EVENT_NAME: "workflow_dispatch",
          GITHUB_REF_TYPE: "branch",
          GITHUB_REF: "refs/heads/main",
          GITHUB_REF_NAME: "main",
        },
        git(),
      ),
    ).toEqual({ manualInitialization: true });
    expect(
      assertCatalogBuildEnvironment({ ...base, GITHUB_EVENT_NAME: "workflow_dispatch" }, git()),
    ).toEqual({ manualInitialization: false, expectedReleaseTag: "notes-v1.2.3" });
  });
  it("rechaza otros repositorios/branches, tag movido y builder fuera de main", () => {
    expect(() =>
      assertCatalogBuildEnvironment({ ...base, GITHUB_REPOSITORY: "fork/repo" }, git()),
    ).toThrow();
    expect(() =>
      assertCatalogBuildEnvironment(
        {
          ...base,
          GITHUB_EVENT_NAME: "workflow_dispatch",
          GITHUB_REF_TYPE: "branch",
          GITHUB_REF: "refs/heads/develop",
          GITHUB_REF_NAME: "develop",
        },
        git(),
      ),
    ).toThrow();
    const moved = git().mockImplementation((args) =>
      args.includes("--verify") ? "b".repeat(40) : commit,
    );
    expect(() => assertCatalogBuildEnvironment(base, moved)).toThrow(/integrated/);
    const untrusted = git().mockReturnValueOnce("b".repeat(40));
    expect(() => assertCatalogBuildEnvironment(base, untrusted)).toThrow(/trusted main/);
    const outside = git().mockImplementation((args) => {
      if (args[0] === "merge-base") throw Error("not integrated");
      return commit;
    });
    expect(() => assertCatalogBuildEnvironment(base, outside)).toThrow();
  });
});
