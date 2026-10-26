import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Note } from "./NoteList.tsx";
import { useNoteFiles } from "./use-note-files.ts";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const note: Note = {
  id: "p",
  title: "Privada",
  body_md: "",
  private: true,
  pinned: false,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  deleted_at: null,
};

function setup() {
  const client = {
    ui: { copyText: vi.fn(async () => {}) },
    files: { pickSave: vi.fn(), writeText: vi.fn(async () => {}) },
  };
  let resolveRename: (value: Note) => void = () => undefined;
  const renaming = { current: new Map([["p", new Promise<Note>((r) => (resolveRename = r))]]) };
  const { result } = renderHook(() =>
    useNoteFiles(client as never, note, "", { current: [note] }, renaming, vi.fn(), vi.fn()),
  );
  return { client, files: result.current, resolveRename };
}

it("no copia el cuerpo privado si se bloqueó mientras esperaba", async () => {
  const { client, files, resolveRename } = setup();
  let unlocked = true;
  const copying = files.copyNote("secreto", () => unlocked);
  unlocked = false;
  resolveRename(note);
  expect(await copying).toBe(false);
  expect(client.ui.copyText).not.toHaveBeenCalled();
});

it("no exporta el cuerpo privado si se bloqueó con el diálogo de guardar abierto", async () => {
  const { client, files, resolveRename } = setup();
  let unlocked = true;
  client.files.pickSave.mockImplementation(async () => {
    unlocked = false;
    return { token: "t", name: "x.md" };
  });
  resolveRename(note);
  await files.exportNote("secreto", () => unlocked);
  expect(client.files.writeText).not.toHaveBeenCalled();
});
