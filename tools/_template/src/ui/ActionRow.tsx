import { Button } from "@lensdesk/ui";

type ActionRowProps = {
  label: string;
  description: string;
  buttonLabel: string;
  disabled?: boolean;
  onClick: () => void;
};

export function ActionRow({ label, description, buttonLabel, disabled, onClick }: ActionRowProps) {
  return (
    <div className="relative flex flex-wrap items-center gap-4 px-4 py-3 before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-border first:before:hidden">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{label}</p>
        <p className="text-[13px] text-muted">{description}</p>
      </div>
      <Button
        type="button"
        variant="default"
        className="shrink-0"
        disabled={disabled}
        onClick={onClick}
      >
        {buttonLabel}
      </Button>
    </div>
  );
}
