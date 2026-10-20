import { cloneElement, type ReactElement } from "react";

export function TooltipTarget({
  element,
  redundant,
  ...props
}: Record<string, unknown> & {
  element: ReactElement<Record<string, unknown>>;
  redundant: boolean;
}) {
  return cloneElement(element, {
    ...props,
    "aria-describedby": redundant ? element.props["aria-describedby"] : props["aria-describedby"],
  });
}
