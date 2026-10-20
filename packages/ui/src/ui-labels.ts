import { createContext, useContext } from "react";

export type UiLabels = {
  loading: string;
  close: string;
  dismiss: string;
};

export const UiLabelsContext = createContext<UiLabels>({
  loading: "Loading",
  close: "Close",
  dismiss: "Dismiss",
});

export function useUiLabels(): UiLabels {
  return useContext(UiLabelsContext);
}
