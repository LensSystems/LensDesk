import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Lock,
  Plus,
  Type,
} from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
export function AddCredentialField({
  onAdd,
  onClosed,
}: {
  onAdd: (secret: boolean) => void;
  onClosed?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          className="h-[30px] gap-1.5 self-start rounded-full border-dashed bg-transparent border-border-control px-3 text-[13px] font-normal"
        >
          <Plus size={15} aria-hidden="true" />
          {t("credential.add")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[234px] rounded-ld-lg p-1.5"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed?.();
        }}
      >
        {[false, true].map((secret) => (
          <DropdownMenuItem
            key={String(secret)}
            className="h-[34px] gap-2.5 px-2.5"
            onSelect={() => onAdd(secret)}
          >
            {secret ? <Lock size={15} aria-hidden="true" /> : <Type size={15} aria-hidden="true" />}
            {t(secret ? "credential.secret" : "credential.text")}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
