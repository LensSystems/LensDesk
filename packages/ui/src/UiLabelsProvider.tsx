import type { ReactNode } from "react";
import { type UiLabels, UiLabelsContext } from "./ui-labels.ts";

export type UiLabelsProviderProps = { labels: UiLabels; children: ReactNode };

export function UiLabelsProvider({ labels, children }: UiLabelsProviderProps) {
  return <UiLabelsContext value={labels}>{children}</UiLabelsContext>;
}
