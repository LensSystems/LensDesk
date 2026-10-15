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
  create: (params, ctx) => getRepository(ctx.dataDir).create(params),
  update: (params, ctx) => getRepository(ctx.dataDir).update(params),
  get: (params, ctx) => getRepository(ctx.dataDir).get(params),
  list: (params, ctx) => getRepository(ctx.dataDir).list(params),
  search: (params, ctx) => getRepository(ctx.dataDir).search(params),
  setPinned: (params, ctx) => getRepository(ctx.dataDir).setPinned(params),
  trash: (params, ctx) => getRepository(ctx.dataDir).trash(params),
  restore: (params, ctx) => getRepository(ctx.dataDir).restore(params),
  emptyTrash: (params, ctx) => getRepository(ctx.dataDir).emptyTrash(params),
} satisfies Record<string, BackendMethod>;

defineBackend({ methods });
