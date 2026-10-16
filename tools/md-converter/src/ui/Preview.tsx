import type { createToolClient } from "@lensdesk/sdk";
import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";
import { type KeyboardEvent, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorCode, type QueueItem } from "./use-queue.ts";

type Client = ReturnType<typeof createToolClient>;
type Tab = "rendered" | "raw";

const markdown = new MarkdownIt({ html: true, linkify: true });

// Todo HTML generado pasa por DOMPurify; las imágenes solo conservan orígenes data:.
export function renderMarkdown(source: string): string {
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if (
      node.nodeName === "IMG" &&
      data.attrName === "src" &&
      !data.attrValue.toLowerCase().startsWith("data:")
    )
      data.keepAttr = false;
  });
  try {
    return DOMPurify.sanitize(markdown.render(source));
  } finally {
    DOMPurify.removeHook("uponSanitizeAttribute");
  }
}

export function Preview({
  client,
  item,
  results,
}: {
  client: Client;
  item: QueueItem | null;
  results: QueueItem[];
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("rendered");
  const [notice, setNotice] = useState("");
  // El HTML saneado solo se recalcula cuando cambia el Markdown, no con cada aviso de progreso.
  const source = item?.markdown ?? "";
  const html = useMemo(() => renderMarkdown(source), [source]);
  const mountHtml = useCallback(
    (element: HTMLElement | null) => {
      if (element) element.innerHTML = html;
    },
    [html],
  );

  const saveOne = async (result: QueueItem) => {
    const file = await client.files.pickSave({
      defaultName: `${result.file.name.replace(/\.[^.]+$/, "")}.md`,
      filters: [{ name: t("markdownFiles"), extensions: ["md"] }],
    });
    if (!file) return false;
    await client.files.writeText(file.token, result.markdown);
    return true;
  };

  const attempt = async (action: () => Promise<string>) => {
    try {
      setNotice(await action());
    } catch (reason) {
      setNotice(t("errors.generic", { code: errorCode(reason) }));
    }
  };

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const next: Tab = tab === "rendered" ? "raw" : "rendered";
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  return (
    <section className="preview-panel">
      <header className="preview-toolbar">
        <div className="tabs" role="tablist" aria-label={t("resultTabs")}>
          {(["rendered", "raw"] as const).map((name) => (
            <button
              key={name}
              id={`tab-${name}`}
              type="button"
              role="tab"
              aria-selected={tab === name}
              aria-controls={`panel-${name}`}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => setTab(name)}
              onKeyDown={onTabKey}
            >
              {t(name)}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!item}
          onClick={() =>
            item &&
            void attempt(async () => {
              await client.ui.copyText(item.markdown);
              return t("copied");
            })
          }
        >
          {t("copy")}
        </button>
        <button
          type="button"
          disabled={!item}
          onClick={() =>
            item && void attempt(async () => t("saved", { count: (await saveOne(item)) ? 1 : 0 }))
          }
        >
          {t("save")}
        </button>
        <button
          type="button"
          disabled={results.length === 0}
          onClick={() =>
            void attempt(async () => {
              let count = 0;
              for (const result of results) if (await saveOne(result)) count += 1;
              return t("saved", { count });
            })
          }
        >
          {t("saveAll")}
        </button>
      </header>
      <p className="notice muted" role="status">
        {notice}
      </p>
      <div
        id={`panel-${tab}`}
        className="preview-body"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
      >
        {!item ? (
          <p className="muted">{t("noResult")}</p>
        ) : tab === "raw" ? (
          <pre className="raw-markdown">
            <code>{item.markdown}</code>
          </pre>
        ) : (
          <article className="rendered-markdown" ref={mountHtml} />
        )}
      </div>
    </section>
  );
}
