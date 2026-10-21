type InstanceWindow = {
  isDestroyed(): boolean;
  isMinimized(): boolean;
  restore(): void;
  show(): void;
  focus(): void;
};

export function configureSingleInstance(options: {
  requestLock(): boolean;
  quit(): void;
  onSecondInstance(listener: () => void): unknown;
  getWindow(): InstanceWindow | undefined;
}): boolean {
  if (!options.requestLock()) {
    options.quit();
    return false;
  }
  options.onSecondInstance(() => {
    const window = options.getWindow();
    if (!window || window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });
  return true;
}
