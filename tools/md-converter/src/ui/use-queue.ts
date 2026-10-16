import type { createToolClient, FileHandle } from "@lensdesk/sdk";
import { useCallback, useEffect, useRef, useState } from "react";

type Client = ReturnType<typeof createToolClient>;

export type QueueStatus = "queued" | "converting" | "done" | "error" | "cancelled";

export type QueueItem = {
  id: string;
  file: FileHandle;
  status: QueueStatus;
  progress: number;
  markdown: string;
  warnings: string[];
  errorCode: string;
};

type ConvertResult = { markdown: string; warnings: string[] };

export function useQueue(client: Client) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // La cola vive en una referencia para que el bucle secuencial lea siempre el estado actual;
  // React solo recibe copias para volver a pintar.
  const itemsRef = useRef<QueueItem[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const running = useRef(false);
  const nextId = useRef(0);

  const commit = useCallback((next: QueueItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const patch = useCallback(
    (id: string, change: Partial<QueueItem>, onlyIf?: QueueStatus) => {
      commit(
        itemsRef.current.map((item) =>
          item.id === id && (!onlyIf || item.status === onlyIf) ? { ...item, ...change } : item,
        ),
      );
    },
    [commit],
  );

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      for (;;) {
        const next = itemsRef.current.find((item) => item.status === "queued");
        if (!next) break;
        const controller = new AbortController();
        controllers.current.set(next.id, controller);
        patch(next.id, { status: "converting", progress: 0 });
        try {
          const result = await client.backend.invoke<ConvertResult>(
            "convert",
            { token: next.file.token, name: next.file.name },
            {
              signal: controller.signal,
              onProgress: ({ fraction }) => patch(next.id, { progress: fraction }, "converting"),
            },
          );
          patch(
            next.id,
            {
              status: "done",
              progress: 1,
              markdown: result.markdown,
              warnings: result.warnings ?? [],
            },
            "converting",
          );
          setSelectedId((current) => current ?? next.id);
        } catch (reason) {
          const code = controller.signal.aborted ? "E_CANCELLED" : errorCode(reason);
          patch(next.id, {
            status: code === "E_CANCELLED" ? "cancelled" : "error",
            errorCode: code,
          });
        } finally {
          controllers.current.delete(next.id);
        }
      }
    } finally {
      running.current = false;
    }
  }, [client, patch]);

  const add = useCallback(
    (files: FileHandle[]) => {
      if (files.length === 0) return;
      const added = files.map((file) => {
        nextId.current += 1;
        return {
          id: `item-${nextId.current}`,
          file,
          status: "queued" as const,
          progress: 0,
          markdown: "",
          warnings: [],
          errorCode: "",
        };
      });
      commit([...itemsRef.current, ...added]);
      void run();
    },
    [commit, run],
  );

  const cancel = useCallback(
    (id: string) => {
      const controller = controllers.current.get(id);
      if (controller) controller.abort();
      else patch(id, { status: "cancelled", errorCode: "E_CANCELLED" }, "queued");
    },
    [patch],
  );

  useEffect(() => client.files.onDrop(add), [client, add]);

  // Al desmontar se cancelan las conversiones en curso para no dejar trabajo en el backend.
  useEffect(() => {
    const active = controllers.current;
    return () => {
      for (const controller of active.values()) controller.abort();
    };
  }, []);

  const selected = items.find((item) => item.id === selectedId && item.status === "done") ?? null;
  return { items, add, cancel, selected, setSelectedId };
}

export function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "E_INTERNAL";
}
