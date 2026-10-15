import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/Button.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";

export function ToolsPage() {
  const { t } = useTranslation();
  return (
    <main className="p-4">
      <h1 className="text-[15px] font-medium">{t("toolsPage.title")}</h1>
      <EmptyState
        title={t("toolsPage.emptyTitle")}
        description={t("toolsPage.emptyDescription")}
        action={<Button>{t("toolsPage.addTool")}</Button>}
      />
    </main>
  );
}
