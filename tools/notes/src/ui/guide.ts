import type { createToolClient } from "@lensdesk/sdk";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import english from "./guide.en.md?raw";
import spanish from "./guide.es.md?raw";

type Client = ReturnType<typeof createToolClient>;
let pending: Promise<void> = Promise.resolve();
// Ya comprobada en esta sesión: no se vuelve a consultar en cada carga de la lista.
const checked = new WeakSet<Client>();

async function initialize(client: Client) {
  if (checked.has(client)) return;
  if ((await client.storage.get("guideCreated")) === true) {
    checked.add(client);
    return;
  }
  const notes = await client.backend.invoke<unknown[]>("list", { trashed: false });
  const trash = await client.backend.invoke<unknown[]>("list", { trashed: true });
  if (notes.length === 0 && trash.length === 0) {
    const { locale } = await client.app.getContext();
    const englishLocale = locale.split("-")[0] === "en";
    await client.backend.invoke("create", {
      title: englishLocale ? en.guideTitle : es.guideTitle,
      body_md: englishLocale ? english : spanish,
    });
  }
  await client.storage.set("guideCreated", true);
  checked.add(client);
}

// Serializa montajes concurrentes; Web Locks cubre también otras vistas del mismo origen.
export function ensureGuide(client: Client): Promise<void> {
  const run = () =>
    navigator.locks
      ? navigator.locks.request("notes-guide", () => initialize(client))
      : initialize(client);
  const result = pending.then(run);
  pending = result.catch(() => undefined);
  return result;
}
