import { contextBridge, ipcRenderer, webUtils } from "electron";
import { createHostBridge, HOST_IPC_CHANNEL } from "../shared/host-channels.ts";

const bridge = createHostBridge(
  (channel, payload) => ipcRenderer.invoke(HOST_IPC_CHANNEL, channel, payload),
  (event, callback) => {
    const listener = (_message: Electron.IpcRendererEvent, payload: unknown): void =>
      callback(payload);
    ipcRenderer.on(event, listener);
    return () => ipcRenderer.removeListener(event, listener);
  },
);

contextBridge.exposeInMainWorld(
  "lensdeskHost",
  Object.freeze({
    ...bridge,
    pathForFile: (file: File) => webUtils.getPathForFile(file),
  }),
);
