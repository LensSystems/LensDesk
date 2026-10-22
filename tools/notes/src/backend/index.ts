import { type BackendMethod, defineBackend } from "@lensdesk/sdk/backend";
import { openNotesDatabase } from "./db/driver.ts";
import { createNotesRepository } from "./notes-repo.ts";

let repository: ReturnType<typeof createNotesRepository> | undefined;

function getRepository(dataDir: string) {
  if (!repository) {
    repository = createNotesRepository(openNotesDatabase(dataDir));
  }
  return repository;
}

export const methods = {
  vaultStatus: (params, ctx) => getRepository(ctx.dataDir).vaultStatus(params),
  vaultSetup: (params, ctx) => getRepository(ctx.dataDir).vaultSetup(params),
  vaultUnlock: (params, ctx) => getRepository(ctx.dataDir).vaultUnlock(params),
  vaultLock: (params, ctx) => getRepository(ctx.dataDir).vaultLock(params),
  vaultReset: (params, ctx) => getRepository(ctx.dataDir).vaultReset(params),
  setPrivate: (params, ctx) => getRepository(ctx.dataDir).setPrivate(params),
  create: (params, ctx) => getRepository(ctx.dataDir).create(params),
  update: (params, ctx) => getRepository(ctx.dataDir).update(params),
  rename: (params, ctx) => getRepository(ctx.dataDir).rename(params),
  get: (params, ctx) => getRepository(ctx.dataDir).get(params),
  list: (params, ctx) => getRepository(ctx.dataDir).list(params),
  search: (params, ctx) => getRepository(ctx.dataDir).search(params),
  setPinned: (params, ctx) => getRepository(ctx.dataDir).setPinned(params),
  archive: (params, ctx) => getRepository(ctx.dataDir).archive(params),
  unarchive: (params, ctx) => getRepository(ctx.dataDir).unarchive(params),
  trash: (params, ctx) => getRepository(ctx.dataDir).trash(params),
  restore: (params, ctx) => getRepository(ctx.dataDir).restore(params),
  emptyTrash: (params, ctx) => getRepository(ctx.dataDir).emptyTrash(params),
} satisfies Record<string, BackendMethod>;

defineBackend({ methods });
