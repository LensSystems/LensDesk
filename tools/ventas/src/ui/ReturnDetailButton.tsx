import { Button, Dialog, DialogTrigger } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ReturnDetailDialog } from "./ReturnDetailDialog.tsx";
import type { ReadQuery } from "./types.ts";
export function ReturnDetailButton({
  returnId,
  read,
  revision,
}: {
  returnId: string;
  read: ReadQuery;
  revision: number;
}) {
  const { t } = useTranslation(),
    [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t("viewReturnDetail")}</Button>
      </DialogTrigger>
      {open ? <ReturnDetailDialog returnId={returnId} read={read} revision={revision} /> : null}
    </Dialog>
  );
}
