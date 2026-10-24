import type { createToolClient } from "@lensdesk/sdk";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { credentialFences } from "./credential-fences.ts";
import type { VaultStatus } from "./use-vault.ts";
import type { useVaultDocument } from "./use-vault-document.ts";
export function useVaultActions(
  client: ReturnType<typeof createToolClient>,
  document: ReturnType<typeof useVaultDocument>,
  visible: { current: boolean },
  refresh: (allowUnlock?: boolean) => Promise<VaultStatus | undefined>,
  reload: () => Promise<boolean>,
) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<
    "notice" | "setup" | "reset" | "unlock" | "unprotect" | null
  >(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const run = async (operation: () => Promise<void>, recovery = false) => {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
      return visible.current;
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : String((reason as { message?: string })?.message ?? "");
      const seconds = /Wait (\d+) seconds/.exec(message)?.[1];
      const remaining = /Invalid credentials\. (\d+) attempts left/.exec(message)?.[1];
      setError(
        seconds
          ? t("vault.wait", { seconds })
          : remaining
            ? t(recovery ? "vault.answersRemaining" : "vault.passwordRemaining", {
                count: Number(remaining),
              })
            : t(message.includes("Wait") ? "vault.waitAgain" : "vault.invalid"),
      );
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  // Lee el cuerpo justo al escribir, después de las esperas; nunca el del clic.
  const write = async (id: string) => {
    await document.settle(id);
    const snapshot = document.current.current;
    if (!visible.current || snapshot.note?.id !== id) return false;
    if (snapshot.note.private) {
      if (snapshot.loaded?.id !== id) return false;
      await document.persist(id, snapshot.body);
    } else await client.backend.invoke("update", { id, body_md: snapshot.publicBody });
    return true;
  };
  const pending = useRef<{ id: string; epoch: number } | null>(null);
  const toggle = (confirmed = false) => {
    const target = document.current.current.note;
    return run(async () => {
      const next = await refresh();
      if (!next || !target || document.current.current.note?.id !== target.id) return;
      if (!next.configured) {
        setDialog("notice");
        return;
      }
      if (!next.unlocked) {
        if (!target.private) setDialog("unlock");
        return;
      }
      const snapshot = document.current.current;
      if (target.private && credentialFences(snapshot.body).length && !confirmed) {
        pending.current = { id: target.id, epoch: document.epoch.current };
        setDialog("unprotect");
        return;
      }
      if (
        confirmed &&
        (pending.current?.id !== target.id || pending.current.epoch !== document.epoch.current)
      ) {
        setDialog(null);
        return;
      }
      if (!(await write(target.id))) return;
      await client.backend.invoke("setPrivate", { id: target.id, private: !target.private });
      setDialog(null);
      await reload();
    });
  };
  return {
    dialog,
    setDialog,
    error,
    busy,
    readOnly: busy || dialog !== null,
    toggle: () => toggle(),
    confirmUnprotect: () => toggle(true),
    setup: (password: string, questions: [string, string], answers: [string, string]) => {
      const id = document.current.current.note?.id;
      const request = document.epoch.current;
      return run(async () => {
        await client.backend.invoke("vaultSetup", { password, questions, answers });
        if (!visible.current) {
          await client.backend.invoke("vaultLock", {});
          return;
        }
        if (request !== document.epoch.current || !id || !(await write(id))) return;
        await client.backend.invoke("setPrivate", { id, private: true });
        await client.backend.invoke("vaultLock", {});
        setDialog(null);
        await refresh();
        await reload();
      });
    },
    unlock: (password: string) =>
      run(async () => {
        await client.backend.invoke("vaultUnlock", { password });
        if (!visible.current) {
          await client.backend.invoke("vaultLock", {});
          return;
        }
        await refresh(true);
      }),
    reset: (password: string, answers: [string, string]) =>
      run(async () => {
        await client.backend.invoke("vaultReset", { password, answers });
        setDialog(null);
        if (!visible.current) {
          await client.backend.invoke("vaultLock", {});
          return;
        }
        await refresh(true);
      }, true),
  };
}
