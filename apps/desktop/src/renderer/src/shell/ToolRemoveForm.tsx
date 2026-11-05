import { Button, Checkbox } from "@lensdesk/ui";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

export function ToolRemoveForm({
  onCancel,
  onConfirm,
}: {
  onCancel(): void;
  onConfirm(deleteData: boolean): void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [deleteData, setDeleteData] = useState(false);
  return (
    <>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-3 rounded-ld-md border border-border bg-surface p-3 font-semibold"
      >
        <Checkbox id={id} checked={deleteData} onCheckedChange={setDeleteData} />
        {t("toolsPage.deleteData")}
      </label>
      <div className="flex justify-end gap-2">
        <Button size="lg" onClick={onCancel}>
          {t("toolsPage.cancel")}
        </Button>
        <Button size="lg" variant="danger" onClick={() => onConfirm(deleteData)}>
          {t("toolsPage.remove")}
        </Button>
      </div>
    </>
  );
}
