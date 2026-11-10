import { randomUUID } from "node:crypto";
import { mkdir, open, readdir, readFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { MAX_BACKUP_BYTES } from "../shared/backup-contracts.ts";
import { hash } from "./backup-json.ts";
import type { Db } from "./db/driver.ts";
import { DomainFault } from "./domain.ts";
export async function copyPrevious(db: Db, dataDir: string, bytes: Uint8Array) {
  const id = randomUUID(),
    dir = join(dataDir, "restore-backups"),
    temp = join(dir, `${id}.tmp`),
    target = join(dir, `${id}.json`),
    digest = hash(bytes);
  try {
    await mkdir(dir, { recursive: true });
    const keep = db.get<{ backupId: string }>(
      "SELECT backupId FROM restore_receipts ORDER BY rowid DESC LIMIT 1",
    )?.backupId;
    for (const name of await readdir(dir))
      if (/^[a-f0-9-]{36}\.(json|tmp)$/.test(name) && name !== `${keep}.json`)
        await unlink(join(dir, name));
    const file = await open(temp, "wx", 0o600);
    try {
      await file.writeFile(bytes);
      await file.sync();
    } finally {
      await file.close();
    }
    if (hash(await readFile(temp)) !== digest) throw new Error("Copy verification");
    await rename(temp, target);
    if (process.platform !== "win32") {
      const directory = await open(dir, "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    }
    return { id, hash: digest };
  } catch {
    throw new DomainFault("E_BACKUP_COPY");
  }
}
export async function previousBytes(db: Db, dataDir: string): Promise<Uint8Array> {
  const receipt = db.get<{ backupId: string; backupHash: string }>(
    "SELECT backupId,backupHash FROM restore_receipts ORDER BY rowid DESC LIMIT 1",
  );
  if (!receipt || !/^[a-f0-9-]{36}$/.test(receipt.backupId)) throw new DomainFault("E_BACKUP_COPY");
  try {
    const bytes = await readFile(join(dataDir, "restore-backups", `${receipt.backupId}.json`));
    if (bytes.length > MAX_BACKUP_BYTES || hash(bytes) !== receipt.backupHash)
      throw new Error("Invalid copy");
    return bytes;
  } catch {
    throw new DomainFault("E_BACKUP_COPY");
  }
}
