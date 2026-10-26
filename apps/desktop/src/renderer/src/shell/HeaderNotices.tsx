import { useEffect, useRef, useState } from "react";
import { useShellStore } from "../state/store.ts";
import { ToastRegion } from "./ToastRegion.tsx";
import { UpdateBanner } from "./UpdateBanner.tsx";

export function HeaderNotices({ bridge }: { bridge: Window["lensdeskHost"] }) {
  const update = useShellStore((state) => state.update);
  const dismissedVersion = useShellStore((state) => state.dismissedVersion);
  const showUpdateSettings = useShellStore((state) => state.showUpdateSettings);
  const dismissUpdate = useShellStore((state) => state.dismissUpdate);
  const toast = useShellStore((state) => state.toasts.at(-1));
  const visibleUpdate = update?.version !== dismissedVersion ? update : null;
  const latest = useRef({ update: visibleUpdate, toast: toast?.id, front: "toast" });
  if (latest.current.update !== visibleUpdate || latest.current.toast !== toast?.id) {
    const front =
      latest.current.toast !== toast?.id && toast ? "toast" : visibleUpdate ? "update" : "toast";
    latest.current = { update: visibleUpdate, toast: toast?.id, front };
  }
  const [pointer, setPointer] = useState(false);
  const [focus, setFocus] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const expanded = pointer || focus;
  // Si se retira el aviso que tenía el foco, el navegador no siempre avisa con `blur`: se
  // comprueba dónde quedó el foco para que la pila se recoja y los avisos sigan caducando.
  const focused = useRef(focus);
  focused.current = focus;
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo al cambiar los avisos.
  useEffect(() => {
    if (focused.current && !root.current?.contains(document.activeElement)) setFocus(false);
  }, [toast?.id, visibleUpdate]);
  const stacked = !!visibleUpdate && !!toast;
  const front = !toast ? "update" : !visibleUpdate ? "toast" : latest.current.front;
  const notices = front === "toast" ? ["toast", "update"] : ["update", "toast"];
  return (
    <div
      ref={root}
      data-notice-stack={stacked ? "" : undefined}
      data-expanded={expanded}
      data-stacked={stacked}
      className={`ld-no-drag ${visibleUpdate || toast ? "mr-1" : ""} flex w-max min-w-0 max-w-full items-center gap-1 [&>*]:min-w-0`}
      onPointerEnter={() => setPointer(true)}
      onPointerLeave={() => setPointer(false)}
      onFocusCapture={() => setFocus(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocus(false);
      }}
    >
      {notices.map((kind) => {
        if (kind === "update" ? !visibleUpdate : !toast) return null;
        const back = kind !== front;
        return (
          <div
            key={kind}
            data-notice-back={back ? "" : undefined}
            data-notice-kind={kind}
            inert={back && !expanded}
            aria-hidden={back && !expanded ? true : undefined}
            className={back ? "ld-notice-back" : "ld-notice-front"}
          >
            {kind === "update" && visibleUpdate ? (
              <UpdateBanner
                update={visibleUpdate}
                onOpenSettings={() => void showUpdateSettings(bridge)}
                onDismiss={() => dismissUpdate(bridge)}
              />
            ) : (
              <ToastRegion bridge={bridge} paused={expanded} stacked={stacked} />
            )}
          </div>
        );
      })}
    </div>
  );
}
