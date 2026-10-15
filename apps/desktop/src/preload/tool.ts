import { contextBridge, ipcRenderer } from "electron";
import { createToolBridge, TOOL_IPC_CHANNEL } from "../shared/tool-channels.ts";

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
