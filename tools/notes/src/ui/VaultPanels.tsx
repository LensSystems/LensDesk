import { useTranslation } from "react-i18next";
import { PasswordSetup } from "./PasswordSetup.tsx";
import { PrivateNotice } from "./PrivateNotice.tsx";
import { ResetPassword } from "./ResetPassword.tsx";
import { UnlockPanel } from "./UnlockPanel.tsx";
import type { useVault } from "./use-vault.ts";
import { VaultDialog } from "./VaultDialog.tsx";
export function VaultPanels({ vault }: { vault: ReturnType<typeof useVault> }) {
  const { t } = useTranslation();
  const onClose = () => vault.setDialog(null);
  return (
    <>
      {vault.dialog === "unlock" && (
        <VaultDialog title={t("vault.unlock")} onClose={onClose}>
          <UnlockPanel
            error={vault.error}
            busy={vault.busy}
            onSubmit={(password) =>
              void vault.unlock(password).then((success) => {
                if (success) void vault.toggle().then(onClose);
              })
            }
            onForgot={() => vault.setDialog("reset")}
          />
        </VaultDialog>
      )}
      {vault.dialog === "notice" && (
        <PrivateNotice onClose={onClose} onContinue={() => vault.setDialog("setup")} />
      )}
      {vault.dialog === "setup" && (
        <PasswordSetup
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
          questions={vault.status.questions}
          onSubmit={(password, answers) => void vault.reset(password, answers)}
        />
      )}
    </>
  );
}
