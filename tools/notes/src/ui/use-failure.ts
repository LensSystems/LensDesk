import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

export type NoticeKind = "error" | "notFound" | "recovered";

export function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "E_INTERNAL";
}

// Aviso visible sobre la lista: el tipo decide si se ofrece "Reintentar" o solo "Cerrar".
export function useNotice() {
  const [notice, setNotice] = useState<{ text: string; kind: NoticeKind }>({
    text: "",
    kind: "error",
  });
  const setError = useCallback(
    (text: string, kind: NoticeKind = "error") => setNotice({ text, kind }),
    [],
  );
  return { error: notice.text, errorKind: notice.kind, setError };
}

// Una nota borrada desde otro sitio responde E_NOT_FOUND: se recarga la lista y solo si la
// recarga funcionó se avisa de que la nota ya no existe.
export function useFail(
  load: () => Promise<boolean>,
  setError: (text: string, kind?: NoticeKind) => void,
) {
  const { t } = useTranslation();
  return useCallback(
    async (reason: unknown) => {
      if (errorCode(reason) === "E_NOT_FOUND") {
        if (await load()) setError(t("errors.notFound"), "notFound");
        return;
      }
      setError(t("errors.generic", { code: errorCode(reason) }));
    },
    [load, setError, t],
  );
}
