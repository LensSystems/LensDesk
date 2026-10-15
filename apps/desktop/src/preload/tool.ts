import { contextBridge, ipcRenderer, webUtils } from "electron";
import {
  createToolBridge,
  registerDroppedFiles,
  TOOL_DROP_REGISTER_CHANNEL,
  TOOL_IPC_CHANNEL,
} from "../shared/tool-channels.ts";

const bridge = createToolBridge(
  (channel, payload) => ipcRenderer.invoke(TOOL_IPC_CHANNEL, channel, payload),
  (event, callback) => {
    const listener = (_message: Electron.IpcRendererEvent, payload: unknown): void =>
      callback(payload);
    ipcRenderer.on(`lensdesk:tool-event:${event}`, listener);
    return () => ipcRenderer.removeListener(`lensdesk:tool-event:${event}`, listener);
  },
);
contextBridge.exposeInMainWorld("lensdesk", bridge);
// Sin cancelar dragover, Chromium nunca dispara drop sobre la página.
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", (event) => {
  event.preventDefault();
  const files = [...(event.dataTransfer?.files ?? [])];
  void registerDroppedFiles(files, webUtils.getPathForFile, (paths) =>
    ipcRenderer.invoke(TOOL_DROP_REGISTER_CHANNEL, paths),
  ).catch(() => undefined);
});
