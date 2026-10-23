import { useShellStore } from "../state/store.ts";
import { ToastRegion } from "./ToastRegion.tsx";
import { UpdateBanner } from "./UpdateBanner.tsx";

// Avisos que viven en el encabezado: la vista de la herramienta tapa todo lo que se pinte debajo.
export function HeaderNotices({ bridge }: { bridge: Window["lensdeskHost"] }) {
  const update = useShellStore((state) => state.update);
  const dismissedVersion = useShellStore((state) => state.dismissedVersion);
  const showUpdateSettings = useShellStore((state) => state.showUpdateSettings);
  const visibleUpdate = update?.version !== dismissedVersion ? update : null;
  const hasToast = useShellStore((state) => state.toasts.length > 0);
  const dismissUpdate = useShellStore((state) => state.dismissUpdate);
  return (
    // Los envoltorios de Radix también deben poder encogerse para que el texto del aviso se recorte.
    <div
      className={`ld-no-drag ${visibleUpdate || hasToast ? "mr-1" : ""} flex w-max min-w-0 max-w-full items-center gap-1 [&>*]:min-w-0`}
    >
      {visibleUpdate && (
        <UpdateBanner
          onOpenSettings={() => void showUpdateSettings(bridge)}
          onDismiss={() => dismissUpdate(bridge)}
          update={visibleUpdate}
        />
      )}
      <ToastRegion bridge={bridge} />
    </div>
  );
}
