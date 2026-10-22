import type { createToolClient } from "@lensdesk/sdk";
import type { Note, NotesView } from "./NoteList.tsx";
export function useNoteActions(
  client: ReturnType<typeof createToolClient>,
  load: (view: NotesView, query: string) => Promise<boolean>,
  view: { current: { notesView: NotesView; query: string } },
  fail: (reason: unknown) => Promise<void>,
  clear: () => void,
) {
  const trashNote = async (id: string) => {
    try {
      await client.backend.invoke("trash", { id });
      await load(view.current.notesView, view.current.query);
    } catch (reason) {
      await fail(reason);
    }
  };
  const archive = async (note: Note) => {
    try {
      await client.backend.invoke(note.archived_at ? "unarchive" : "archive", { id: note.id });
      await load(view.current.notesView, view.current.query);
    } catch (reason) {
      await fail(reason);
    }
  };
  const restore = async (id: string) => {
    try {
      await client.backend.invoke("restore", { id });
      await load(view.current.notesView, view.current.query);
    } catch (reason) {
      await fail(reason);
    }
  };
  const emptyTrash = async () => {
    try {
      await client.backend.invoke("emptyTrash", {});
      clear();
      await load(view.current.notesView, view.current.query);
    } catch (reason) {
      await fail(reason);
    }
  };
  return { trashNote, archive, restore, emptyTrash };
}
