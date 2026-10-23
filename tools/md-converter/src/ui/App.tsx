import type { createToolClient } from "@lensdesk/sdk";
import {
  applyDocumentContext,
  type DocumentContext,
  Notice,
  TooltipProvider,
  UiLabelsProvider,
} from "@lensdesk/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Preview } from "./Preview.tsx";
import { Queue } from "./Queue.tsx";
import { errorCode, useQueue } from "./use-queue.ts";

type Client = ReturnType<typeof createToolClient>;

const EXTENSIONS = ["html", "htm", "docx", "csv", "pdf", "xlsx"];

export function App({ client }: { client: Client }) {
  const { t, i18n } = useTranslation();
  const queue = useQueue(client);
  useEffect(() => {
    document.title = t("title");
  }, [t]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const applyContext = (context: DocumentContext) => {
      applyDocumentContext(context);
      void i18n.changeLanguage(context.locale);
    };
    void client.app
      .getContext()
      .then((context) => {
        if (alive) applyContext(context);
      })
      .catch(() => undefined);
    const unsubscribe = client.app.onContextChange(applyContext);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [client, i18n]);

  const choose = async () => {
    try {
      const files = await client.files.pickOpen({
        multiple: true,
        filters: [{ name: t("supportedFiles"), extensions: EXTENSIONS }],
      });
      setError("");
      queue.add(files);
    } catch (reason) {
      setError(t("errors.generic", { code: errorCode(reason) }));
    }
  };

  return (
    <UiLabelsProvider labels={{ loading: t("loading"), close: t("close"), dismiss: t("close") }}>
      <TooltipProvider>
        <main className="converter-app">
          {error && <Notice tone="danger" title={error} />}
          <div className="workspace">
            <Queue
              items={queue.items}
              selectedId={queue.selected?.id ?? null}
              onChoose={() => void choose()}
              onSelect={queue.setSelectedId}
              onCancel={queue.cancel}
              onClear={queue.clear}
            />
            <Preview
              client={client}
              onSaved={queue.markSaved}
              item={queue.selected}
              results={queue.items.filter((item) => item.status === "done")}
            />
          </div>
        </main>
      </TooltipProvider>
    </UiLabelsProvider>
  );
}
