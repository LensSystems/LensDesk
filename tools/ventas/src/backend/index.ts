import { isMainThread, parentPort, workerData } from "node:worker_threads";
import { type BackendMethod, defineBackend } from "@lensdesk/sdk/backend";
import { createWorkerClient, databaseWorkerFactory } from "./worker-client.ts";
import { workerMarker } from "./worker-protocol.ts";
import { runDatabaseWorker } from "./worker-runner.ts";

const databaseWorker = !isMainThread && workerData?.marker === workerMarker;
const backend = databaseWorker
  ? undefined
  : createWorkerClient(databaseWorkerFactory(new URL(import.meta.url)));
export const methods: Record<string, BackendMethod> = backend?.methods ?? Object.create(null);
export async function dispose() {
  await backend?.dispose();
}
if (databaseWorker) {
  if (!parentPort || typeof workerData.dataDir !== "string")
    throw new Error("Invalid database worker");
  runDatabaseWorker(parentPort, workerData.dataDir);
} else {
  defineBackend({ methods });
}
