import type { createToolClient } from "@lensdesk/sdk";
import { useTranslation } from "react-i18next";
import type { Note } from "./NoteList.tsx";
import { exportMarkdown, importMarkdown } from "./note-markdown.ts";
export function useNoteFiles(
  client: ReturnType<typeof createToolClient>,
  selected: Note | null,
  body: string,
  notesRef: { current: Note[] },
  renaming: { current: Map<string, Promise<Note>> },
  create: (content?: string, title?: string) => Promise<boolean | undefined>,
  fail: (reason: unknown) => Promise<void>,
) {
  const { t } = useTranslation();
  const importNotes = async () => {
    try {
      const files = await client.files.pickOpen({
        multiple: true,
        filters: [{ name: t("markdownFiles"), extensions: ["md", "markdown"] }],
      });
      for (const file of files) {
        const imported = importMarkdown(await client.files.readText(file.token), file.name);
        await create(imported.body_md, imported.title);
      }
    } catch (reason) {
      await fail(reason);
    }
  };

  // `allowed` se vuelve a comprobar tras cada espera: si la nota privada se bloqueó mientras tanto,
  // no se copia ni se escribe su contenido.
  const copyNote = async (bodyOverride?: string, allowed: () => boolean = () => true) => {
    if (!selected || (selected.private && bodyOverride === undefined)) return false;
    try {
      const updated = await renaming.current.get(selected.id);
      const title =
        updated?.title ??
        notesRef.current.find((note) => note.id === selected.id)?.title ??
        selected.title;
      if (!allowed()) return false;
      await client.ui.copyText(`# ${title}\n\n${bodyOverride ?? body}`);
      return true;
    } catch (reason) {
      await fail(reason);
      return false;
    }
  };

  const exportNote = async (bodyOverride?: string, allowed: () => boolean = () => true) => {
    if (!selected || (selected.private && bodyOverride === undefined)) return;
    try {
      const updated = await renaming.current.get(selected.id);
      const title =
        updated?.title ??
        notesRef.current.find((note) => note.id === selected.id)?.title ??
        selected.title;
      const file = await client.files.pickSave({
        defaultName: `${title || t("untitled")}.md`,
        filters: [{ name: t("markdownFiles"), extensions: ["md"] }],
      });
      if (file && allowed())
        await client.files.writeText(file.token, exportMarkdown(title, bodyOverride ?? body));
    } catch (reason) {
      await fail(reason);
    }
  };

  return { importNotes, copyNote, exportNote };
}
