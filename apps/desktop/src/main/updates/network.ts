export type UpdateHttpFetch = (
  url: string,
  init: {
    method: "GET";
    headers: Record<string, string>;
    signal: AbortSignal;
    redirect: "error";
    credentials: "omit";
  },
) => Promise<Pick<Response, "ok" | "status" | "headers" | "body" | "url" | "redirected">>;

export const UPDATE_TIMEOUT_MS = 10_000;
export const APP_RELEASE_BYTES = 512 * 1024;

// The caller supplies an exact allowlisted endpoint, never a URL from remote JSON.
// The deadline covers fetching and consuming the body, including injected transports.
export async function readUpdateText(options: {
  url: string;
  accept: string;
  maxBytes: number;
  fetch: UpdateHttpFetch;
  timeoutMs?: number;
}): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      void reader?.cancel().catch(() => undefined);
      reject(new Error("Update request timed out"));
    }, options.timeoutMs ?? UPDATE_TIMEOUT_MS);
  });
  const read = async () => {
    const response = await options.fetch(options.url, {
      method: "GET",
      headers: { Accept: options.accept },
      signal: controller.signal,
      redirect: "error",
      credentials: "omit",
    });
    if (controller.signal.aborted) {
      await response.body?.cancel();
      throw new Error("Update request timed out");
    }
    if (!response.ok) throw new Error(`Update source returned ${response.status}`);
    if (response.redirected || (response.url && response.url !== options.url))
      throw new Error("Update source redirected");
    const length = response.headers.get("content-length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > options.maxBytes)) {
      await response.body?.cancel();
      throw new Error("Update response exceeds byte limit");
    }
    reader = response.body?.getReader();
    if (!reader) throw new Error("Update response has no body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const next = await reader.read();
      if (controller.signal.aborted) throw new Error("Update request timed out");
      if (next.done) break;
      size += next.value.byteLength;
      if (size > options.maxBytes) throw new Error("Update response exceeds byte limit");
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  };
  try {
    return await Promise.race([read(), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    controller.abort();
    void reader?.cancel().catch(() => undefined);
  }
}
