import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("lensdeskHost", Object.freeze({ ready: true }));
