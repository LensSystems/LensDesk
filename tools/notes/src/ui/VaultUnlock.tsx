import { UnlockPanel } from "./UnlockPanel.tsx";
import type { useVault } from "./use-vault.ts";
export function VaultUnlock({
  vault,
  protecting = false,
}: {
  vault: ReturnType<typeof useVault>;
  protecting?: boolean;
}) {
  return (
    <UnlockPanel
      error={vault.error}
      busy={vault.busy}
      lockout={vault.status.lockout}
      onSubmit={(password) =>
        void vault.unlock(password).then((success) => {
          if (success && protecting) void vault.toggle();
        })
      }
      onForgot={() => vault.setDialog("reset")}
      onWipe={() => vault.setDialog("wipe")}
    />
  );
}
