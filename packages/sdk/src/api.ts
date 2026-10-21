import type { Result } from "./errors.ts";

export type FileHandle = { token: string; name: string; size: number };
export type ToolContext = {
  locale: string;
  theme: string;
  accent?: "blue" | "green";
  hostVersion: string;
  toolVersion: string;
};
export type ProgressEvent = { fraction: number; message?: string };
export type BackendProgressEvent = ProgressEvent & { requestId: string };
export type InvokeOptions = {
  onProgress?: (progress: ProgressEvent) => void;
  signal?: AbortSignal;
};
export type FileFilter = { name: string; extensions: string[] };

export type ToolBridge = {
  storage: {
    get: (key: string) => Promise<Result<unknown>>;
    set: (key: string, value: unknown) => Promise<Result<void>>;
    delete: (key: string) => Promise<Result<void>>;
    keys: () => Promise<Result<string[]>>;
  };
  files: {
    pickOpen: (options: {
      filters?: FileFilter[];
      multiple?: boolean;
    }) => Promise<Result<FileHandle[]>>;
    pickSave: (options: {
      defaultName?: string;
      filters?: FileFilter[];
    }) => Promise<Result<FileHandle | null>>;
    readText: (token: string) => Promise<Result<string>>;
    readBytes: (token: string) => Promise<Result<Uint8Array>>;
    writeText: (token: string, text: string) => Promise<Result<void>>;
    onDrop: (callback: (files: FileHandle[]) => void) => () => void;
  };
  backend: {
    invoke: (requestId: string, method: string, params: unknown) => Promise<Result<unknown>>;
    cancel: (requestId: string) => Promise<Result<void>>;
    onProgress: (callback: (event: BackendProgressEvent) => void) => () => void;
  };
  app: {
    // Opcional: los hosts anteriores no lo tienen.
    onVisibilityChange?: (callback: (visible: boolean) => void) => () => void;
    getContext: () => Promise<Result<ToolContext>>;
    onContextChange: (callback: (context: ToolContext) => void) => () => void;
  };
  ui: {
    toast: (toast: { kind: string; message: string }) => Promise<Result<void>>;
    copyText: (text: string) => Promise<Result<void>>;
    openExternal: (httpsUrl: string) => Promise<Result<void>>;
  };
};
