import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl.tsx";
import { Tabs, TabsList, TabsTrigger } from "./Tabs.tsx";

function Selector({ tabs }: { tabs: boolean }) {
  const [value, setValue] = useState("uno");
  return tabs ? (
    <Tabs value={value} onValueChange={setValue}>
      <TabsList aria-label="Vista">
        <TabsTrigger value="uno">Uno</TabsTrigger>
        <span>
          <TabsTrigger value="dos">Dos</TabsTrigger>
        </span>
      </TabsList>
    </Tabs>
  ) : (
    <SegmentedControl
      aria-label="Vista"
      value={value}
      onValueChange={setValue}
      options={[
        { value: "uno", label: "Uno" },
        { value: "dos", label: "Dos" },
      ]}
    />
  );
}

afterEach(() => vi.restoreAllMocks());

it.each([false, true])(
  "mide una única píldora y limita el movimiento al puntero (%s)",
  async (tabs) => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      return {
        left: this.textContent === "Dos" ? 80 : 0,
        top: 0,
        width: 80,
        height: 28,
        right: 80,
        bottom: 28,
        x: 0,
        y: 0,
        toJSON() {},
      };
    });
    render(<Selector tabs={tabs} />);
    const root = screen.getByRole(tabs ? "tablist" : "radiogroup");
    expect(root.querySelectorAll('.ld-indicator[aria-hidden="true"]')).toHaveLength(1);
    expect(root).toHaveAttribute("data-motion", "off");
    const second = screen.getByRole(tabs ? "tab" : "radio", { name: "Dos" });
    fireEvent.pointerDown(second, { button: 0 });
    fireEvent.mouseDown(second, { button: 0, ctrlKey: false });
    fireEvent.click(second, { detail: 1 });
    await waitFor(() => expect(root).toHaveAttribute("data-motion", "on"));
    second.focus();
    fireEvent.keyDown(second, { key: "ArrowLeft" });
    await waitFor(() => expect(root).toHaveAttribute("data-motion", "off"));
  },
);
