import type { createToolClient } from "@lensdesk/sdk";
import {
  Button,
  Check,
  Copy,
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
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { renderMarkdown } from "./render-markdown.ts";

export { renderMarkdown } from "./render-markdown.ts";

import { SaveAllStack } from "./SaveAllStack.tsx";
import { usePreviewActions } from "./use-preview-actions.ts";
import type { QueueItem } from "./use-queue.ts";
import { useSaveAll } from "./use-save-all.ts";

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
  const { t, i18n } = useTranslation();
  const { copyButton, copied, copy, attempt, notice } = usePreviewActions(client, item);
  const batch = useSaveAll();
  const [tab, setTab] = useState("rendered");
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
            onClick={() => void copy()}
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
            aria-disabled={batch.busy}
            disabled={item?.status !== "done"}
            onClick={() =>
              !batch.isRunning() && item && void attempt("saveFailed", () => saveOne(item))
            }
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
            aria-disabled={batch.busy}
            aria-busy={batch.busy}
            disabled={results.length === 0}
            onClick={() => {
              if (!batch.isRunning() && results.length > 0)
                void attempt("saveAllFailed", () => batch.saveAll(results, saveOne));
            }}
          >
            <SaveAllStack className="compact-icon" />
            <span className="normal-label">{t("saveAll")}</span>
          </Button>
        </Tooltip>
      </header>
      {item && item.warnings.length > 0 && (
        <Notice className="result-notice" tone="info" title={t("imagesOmitted")} />
      )}
      {notice && <Notice className="result-notice" tone="danger" title={t(`errors.${notice}`)} />}
      {batch.busy && <Notice className="result-notice" tone="info" title={t("savingAll")} />}
      {batch.outcome && (
        <Notice
          className="result-notice"
          tone={batch.outcome.kind === "failed" ? "danger" : "info"}
          title={t(`saveAllResult.${batch.outcome.kind}`, {
            saved: new Intl.NumberFormat(i18n.language).format(batch.outcome.saved),
            total: new Intl.NumberFormat(i18n.language).format(batch.outcome.total),
          })}
        />
      )}
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
              <MarkdownView variant="reading" html={html} />
            )}
          </Skeleton>
        </TabsContent>
      ))}
    </Tabs>
  );
}
