import { renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ensureGuide } from "./guide.ts";
import { renderPreview } from "./preview.ts";
import { useNotes } from "./use-notes.ts";

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});
vi.mock("./use-app-context.ts", () => ({ useAppContext: () => {} }));

function setup(locale = "es", existing: "notes" | "trash" | "archived" | null = null) {
  let marked = false;
  const rows: {
    id: string;
    title: string;
    body_md: string;
    deleted_at: string | null;
    archived_at: string | null;
  }[] = existing
    ? [
        {
          id: "old",
          title: "Old",
          body_md: "",
          deleted_at: existing === "trash" ? "now" : null,
          archived_at: existing === "archived" ? "now" : null,
        },
      ]
    : [];
  const storage = {
    get: vi.fn(async () => marked),
    set: vi.fn(async () => {
      marked = true;
    }),
  };
  const invoke = vi.fn(async (method: string, params: Record<string, unknown>) => {
    if (method === "list")
      return rows.filter((row) => {
        const view = params.view ?? (params.trashed ? "trash" : "notes");
        return view === "trash"
          ? Boolean(row.deleted_at)
          : !row.deleted_at && Boolean(row.archived_at) === (view === "archived");
      });
    if (method === "create") {
      const row = {
        id: "guide",
        title: String(params.title),
        body_md: String(params.body_md),
        deleted_at: null,
        archived_at: null,
      };
      rows.push(row);
      return row;
    }
  });
  const client = {
    storage,
    backend: { invoke },
    app: { getContext: vi.fn(async () => ({ locale })) },
  };
  return { client: client as unknown as Parameters<typeof ensureGuide>[0], rows, storage, invoke };
}

describe("guía inicial", () => {
  it.each([
    ["es", "Guía de Markdown", "¡Bienvenido"],
    ["en", "Markdown Guide", "Welcome"],
    ["en-US", "Markdown Guide", "Welcome"],
  ])("crea una sola vez en %s", async (locale, title, greeting) => {
    const fake = setup(locale);
    await ensureGuide(fake.client);
    await ensureGuide(fake.client);
    expect(fake.rows).toHaveLength(1);
    expect(fake.rows[0]?.title).toBe(title);
    expect(fake.rows[0]?.body_md).toContain(greeting);
    expect(fake.storage.set).toHaveBeenCalledWith("guideCreated", true);
    const html = renderPreview(fake.rows[0]?.body_md ?? "");
    for (const tag of [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "strong",
      "em",
      "u",
      "s",
      "a",
      "code",
      "ul",
      "ol",
      "blockquote",
      "figcaption",
      "table",
      "hr",
    ]) {
      expect(html).toContain(`<${tag}`);
    }
    expect(fake.rows[0]?.body_md).toContain("- [ ]");
    expect(fake.rows[0]?.body_md).toContain("- [x]");
  });

  it("borrarla y vaciar la papelera no la recrea", async () => {
    const fake = setup();
    await ensureGuide(fake.client);
    fake.rows.length = 0;
    await ensureGuide(fake.client);
    expect(fake.rows).toHaveLength(0);
  });

  it.each(["notes", "trash", "archived"] as const)(
    "marca sin crear si ya hay %s",
    async (existing) => {
      const fake = setup("es", existing);
      await ensureGuide(fake.client);
      expect(fake.rows).toHaveLength(1);
      expect(fake.rows[0]?.id).toBe("old");
      expect(fake.storage.set).toHaveBeenCalledWith("guideCreated", true);
      fake.rows.length = 0;
      await ensureGuide(fake.client);
      expect(fake.rows).toHaveLength(0);
    },
  );

  it("serializa carreras entre clientes con almacenamiento compartido", async () => {
    const fake = setup();
    await Promise.all([
      ensureGuide(fake.client),
      ensureGuide({ ...fake.client }),
      ensureGuide(fake.client),
    ]);
    expect(fake.rows).toHaveLength(1);
  });

  it("doble montaje en StrictMode carga una sola guía", async () => {
    const fake = setup();
    const first = renderHook(() => useNotes(fake.client), { wrapper: StrictMode });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.selected?.title).toBe("Guía de Markdown");
    first.unmount();
    const second = renderHook(() => useNotes(fake.client), { wrapper: StrictMode });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(fake.rows).toHaveLength(1);
    expect(second.result.current.selected?.id).toBe("guide");
  });

  it("no marca si crear falla y permite reintentar", async () => {
    const fake = setup();
    fake.invoke
      .mockImplementationOnce(async () => [])
      .mockImplementationOnce(async () => [])
      .mockImplementationOnce(async () => [])
      .mockRejectedValueOnce(new Error("create failed"));
    await expect(ensureGuide(fake.client)).rejects.toThrow("create failed");
    expect(fake.storage.set).not.toHaveBeenCalled();
    await ensureGuide(fake.client);
    expect(fake.rows).toHaveLength(1);
  });

  it("si falla guardar la marca, reintentar no duplica la nota creada", async () => {
    const fake = setup();
    fake.storage.set.mockRejectedValueOnce(new Error("storage failed"));
    await expect(ensureGuide(fake.client)).rejects.toThrow("storage failed");
    await ensureGuide(fake.client);
    expect(fake.rows).toHaveLength(1);
    expect(fake.storage.set).toHaveBeenLastCalledWith("guideCreated", true);
  });

  it("carga la lista aunque falle la guía", async () => {
    const fake = setup("es", "notes");
    fake.storage.get.mockRejectedValue(new Error("sin almacenamiento"));
    const hook = renderHook(() => useNotes(fake.client));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.notes.map((note) => note.id)).toEqual(["old"]);
    expect(hook.result.current.error).toBe("");
  });
});
