import type { createToolClient } from "@lensdesk/sdk";
import {
  Button,
  Check,
  Copy,
  EmptyState,
  Eye,
  FileText,
  MarkdownRaw,
  MarkdownView,
  Notice,
  SaveMarkdown,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from "@lensdesk/ui";
import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SaveAllStack } from "./SaveAllStack.tsx";
import { errorCode, type QueueItem } from "./use-queue.ts";

type Client = ReturnType<typeof createToolClient>;

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
  onSaved,
}: {
  client: Client;
  item: QueueItem | null;
  results: QueueItem[];
  onSaved: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const [tab, setTab] = useState("rendered");
  const [notice, setNotice] = useState("");
  // El HTML saneado solo se recalcula cuando cambia el Markdown, no con cada aviso de progreso.
  const source = item?.markdown ?? "";
  const html = useMemo(() => renderMarkdown(source), [source]);
  const saveOne = async (result: QueueItem) => {
    const file = await client.files.pickSave({
      defaultName: `${result.file.name.replace(/\.[^.]+$/, "")}.md`,
      filters: [{ name: t("markdownFiles"), extensions: ["md"] }],
    });
    if (!file) return false;
    await client.files.writeText(file.token, result.markdown);
    onSaved(result.id);
    return true;
  };

  const attempt = async (action: () => Promise<string>) => {
    try {
      setNotice(await action());
    } catch (reason) {
      setNotice(t("errors.generic", { code: errorCode(reason) }));
    }
  };

  return (
    <Tabs value={tab} onValueChange={setTab} className="preview-panel">
      <header className="preview-toolbar">
        <TabsList className="mr-auto" aria-label={t("resultTabs")}>
          {(["rendered", "raw"] as const).map((name) => (
            <Tooltip key={name} label={t(name)}>
              <span className="inline-flex">
                <TabsTrigger
                  className="data-[state=active]:bg-surface-raised data-[state=active]:text-text data-[state=active]:font-semibold data-[state=active]:shadow-none"
                  value={name}
                  aria-label={t(name)}
                  onClick={() => setTab(name)}
                >
                  <span className="compact-icon">
                    {name === "rendered" ? (
                      <Eye size={15} aria-hidden="true" />
                    ) : (
                      <MarkdownRaw width={15} height={15} aria-hidden="true" />
                    )}
                  </span>
                  <span className="normal-label">{t(name)}</span>
                </TabsTrigger>
              </span>
            </Tooltip>
          ))}
        </TabsList>
        <Tooltip label={t(copied ? "copied" : "copy")}>
          <Button
            type="button"
            variant="ghost"
            className={copied ? "copy-confirmation" : "size-8 p-0 text-muted"}
            aria-label={t(copied ? "copied" : "copy")}
            disabled={!item}
            onClick={() =>
              item &&
              void (async () => {
                try {
                  await client.ui.copyText(item.markdown);
                  clearTimeout(copyTimer.current);
                  setCopied(true);
                  copyTimer.current = setTimeout(() => setCopied(false), 2000);
                } catch (reason) {
                  setNotice(t("errors.generic", { code: errorCode(reason) }));
                }
              })()
            }
          >
            {copied ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Copy size={16} aria-hidden="true" />
            )}
            {copied && <span>{t("copied")}</span>}
          </Button>
        </Tooltip>
        <Tooltip label={t("save")}>
          <Button
            type="button"
            className="save-action"
            aria-label={t("save")}
            disabled={!item}
            onClick={() =>
              item && void attempt(async () => t("saved", { count: (await saveOne(item)) ? 1 : 0 }))
            }
          >
            <SaveMarkdown chip className="compact-icon" aria-hidden="true" />
            <span className="normal-label">{t("save")}</span>
          </Button>
        </Tooltip>
        <Tooltip label={t("saveAll")}>
          <Button
            type="button"
            className="save-action bg-surface"
            aria-label={t("saveAll")}
            disabled={results.length === 0}
            onClick={() =>
              void attempt(async () => {
                let count = 0;
                for (const result of results) if (await saveOne(result)) count += 1;
                return t("saved", { count });
              })
            }
          >
            <SaveAllStack className="compact-icon" />
            <span className="normal-label">{t("saveAll")}</span>
          </Button>
        </Tooltip>
      </header>
      {item && item.warnings.length > 0 && (
        <Notice className="result-notice" tone="info" title={t("imagesOmitted")} />
      )}
      {notice && <Notice className="result-notice" tone="info" title={notice} />}
      {(["rendered", "raw"] as const).map((name) => (
        <TabsContent key={name} value={name} className="preview-body">
          {!item ? (
            <div className="result-empty">
              <FileText size={32} aria-hidden="true" />
              <EmptyState title={t("noResult")} />
            </div>
          ) : name === "raw" ? (
            <pre className="result-column raw-markdown">
              <code>{item.markdown}</code>
            </pre>
          ) : (
            <MarkdownView className="result-column" html={html} />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
