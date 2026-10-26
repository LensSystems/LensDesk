import type { createToolClient } from "@lensdesk/sdk";
import {
  Button,
  Check,
  Copy,
  changeCopyState,
  copiedText,
  EmptyState,
  Eye,
  FileText,
  MarkdownRaw,
  MarkdownView,
  Notice,
  SaveMarkdown,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from "@lensdesk/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { renderMarkdown } from "./render-markdown.ts";

export { renderMarkdown } from "./render-markdown.ts";

import { SaveAllStack } from "./SaveAllStack.tsx";
import { errorCode, type QueueItem } from "./use-queue.ts";

type Client = ReturnType<typeof createToolClient>;

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
  const copyButton = useRef<HTMLButtonElement>(null);
  const updateCopied = (value: boolean) => {
    if (!copyButton.current) return setCopied(value);
    changeCopyState(copyButton.current, () => flushSync(() => setCopied(value)));
  };
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

  const attempt = async (action: () => Promise<unknown>) => {
    try {
      setNotice("");
      await action();
    } catch (reason) {
      setNotice(t("errors.generic", { code: errorCode(reason) }));
    }
  };

  return (
    <Tabs value={tab} onValueChange={setTab} className="preview-panel">
      <header className="preview-toolbar">
        <TabsList indicatorClassName="shadow-none" className="mr-auto" aria-label={t("resultTabs")}>
          {(["rendered", "raw"] as const).map((name) => (
            <Tooltip key={name} label={t(name)} visibleTextSelector=".normal-label">
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
        {/* Sin desmontar el botón: la etiqueta se apaga sola mientras se ve «Copiado». */}
        <Tooltip label={t(copied ? "copied" : "copy")} visibleTextSelector={copiedText}>
          <Button
            type="button"
            variant="ghost"
            ref={copyButton}
            className={copied ? "copy-confirmation" : "size-8 p-0 text-muted"}
            aria-label={t(copied ? "copied" : "copy")}
            disabled={item?.status !== "done"}
            onClick={() =>
              item &&
              void (async () => {
                try {
                  await client.ui.copyText(item.markdown);
                  clearTimeout(copyTimer.current);
                  updateCopied(true);
                  copyTimer.current = setTimeout(() => updateCopied(false), 2000);
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
        <Tooltip label={t("save")} visibleTextSelector=".normal-label">
          <Button
            type="button"
            className="save-action"
            aria-label={t("save")}
            disabled={item?.status !== "done"}
            onClick={() => item && void attempt(() => saveOne(item))}
          >
            <SaveMarkdown chip className="compact-icon" aria-hidden="true" />
            <span className="normal-label">{t("save")}</span>
          </Button>
        </Tooltip>
        <Tooltip label={t("saveAll")} visibleTextSelector=".normal-label">
          <Button
            type="button"
            className="save-action bg-surface"
            aria-label={t("saveAll")}
            disabled={results.length === 0}
            onClick={() =>
              void attempt(async () => {
                for (const result of results) await saveOne(result);
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
          <Skeleton
            key={item?.id ?? "empty"}
            loading={item?.status === "queued" || item?.status === "converting"}
            label={t("loading")}
          >
            {item?.status !== "done" ? (
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
          </Skeleton>
        </TabsContent>
      ))}
    </Tabs>
  );
}
