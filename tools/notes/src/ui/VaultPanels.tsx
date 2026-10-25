import { ConfirmDialog } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { AttemptLimitNotice } from "./AttemptLimitNotice.tsx";
import { PasswordSetup } from "./PasswordSetup.tsx";
import { PrivateNotice } from "./PrivateNotice.tsx";
import { ResetPassword } from "./ResetPassword.tsx";
import type { useVault } from "./use-vault.ts";
import { VaultDialog } from "./VaultDialog.tsx";
import { VaultUnlock } from "./VaultUnlock.tsx";
import { WipeVaultDialog } from "./WipeVaultDialog.tsx";
export function VaultPanels({ vault }: { vault: ReturnType<typeof useVault> }) {
  const { t } = useTranslation();
  const onClose = () => vault.setDialog(null);
  return (
    <>
      <ConfirmDialog
        open={vault.dialog === "unprotect"}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={t("vault.remove")}
        description={t("credential.warning")}
        confirmLabel={t("vault.remove")}
        cancelLabel={t("close")}
        busy={vault.busy}
        onConfirm={() => void vault.confirmUnprotect()}
      />
      {vault.dialog === "unlock" && (
        <VaultDialog title={t("vault.unlock")} onClose={onClose}>
          <VaultUnlock vault={vault} protecting />
        </VaultDialog>
      )}
      {vault.dialog === "notice" && (
        <PrivateNotice onClose={onClose} onContinue={() => vault.setDialog("setup")} />
      )}
      {vault.dialog === "setup" && (
        <PasswordSetup
          onBack={() => vault.setDialog("notice")}
          onClose={onClose}
          error={vault.error}
          busy={vault.busy}
          onSubmit={(password, questions, answers) =>
            void vault.setup(password, questions, answers)
          }
        />
      )}
      {vault.dialog === "reset" && (
        <ResetPassword
          onClose={onClose}
          error={vault.error}
          busy={vault.busy}
          lockout={vault.status.lockout}
          questions={vault.status.questions}
          onSubmit={(password, answers) => void vault.reset(password, answers)}
        />
      )}
      {vault.dialog === "limit" && (
        <AttemptLimitNotice
          onClose={vault.dismissAttemptNotice}
          onWipe={() => vault.setDialog("wipe")}
        />
      )}
      <ConfirmDialog
        open={vault.dialog === "exhausted"}
        tone="danger"
        title={t("vault.exhausted")}
        description={t("vault.lastFailed")}
        cancelLabel={t("close")}
        confirmLabel={t("vault.wipe")}
        onOpenChange={(open) => {
          if (!open) vault.dismissAttemptNotice();
        }}
        onConfirm={() => vault.setDialog("wipe")}
      />
      {vault.dialog === "wipe" && (
        <WipeVaultDialog
          privateCount={vault.status.privateCount}
          busy={vault.busy}
          error={vault.error}
          onClose={vault.dismissAttemptNotice}
          onConfirm={() => void vault.wipe()}
        />
      )}
    </>
  );
}
