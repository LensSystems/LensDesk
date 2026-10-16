import { useShellStore } from "../state/store.ts";
import { ToastRegion } from "./ToastRegion.tsx";
import { UpdateBanner } from "./UpdateBanner.tsx";

// Avisos que viven en el encabezado: la vista de la herramienta tapa todo lo que se pinte debajo.
export function HeaderNotices({ bridge }: { bridge: Window["lensdeskHost"] }) {
  const update = useShellStore((state) => state.update);
  const dismissUpdate = useShellStore((state) => state.dismissUpdate);
  return (
    <>
      {update && (
        <UpdateBanner bridge={bridge} onDismiss={() => dismissUpdate(bridge)} update={update} />
      )}
      <ToastRegion />
    </>
  );
}
