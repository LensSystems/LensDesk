import { Input } from "@lensdesk/ui";
import { useLayoutEffect, useRef } from "react";
import { inputMoney } from "./format.ts";

export function MoneyInput({
  label,
  value,
  onChange,
  disabled = false,
  required = true,
  name,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
}) {
  const wrapper = useRef<HTMLDivElement>(null),
    caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caret.current !== null) {
      wrapper.current?.querySelector("input")?.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });
  const apply = (raw: string, position: number) => {
    const formatted = inputMoney(raw);
    if (formatted === null) return false;
    const logical = raw.slice(0, position).replaceAll(",", "").length;
    let seen = 0,
      index = 0;
    while (index < formatted.length && seen < logical) {
      if (formatted[index] !== ",") seen++;
      index++;
    }
    caret.current = index;
    onChange(formatted);
    return true;
  };
  return (
    <div ref={wrapper}>
      <Input
        label={label}
        name={name}
        value={inputMoney(value) ?? value}
        disabled={disabled}
        required={required}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        maxLength={24}
        onChange={(e) => {
          if (!apply(e.target.value, e.target.selectionStart ?? e.target.value.length))
            e.target.value = value;
        }}
        onKeyDown={(e) => {
          const input = e.currentTarget,
            start = input.selectionStart ?? 0,
            end = input.selectionEnd ?? start;
          if (start !== end) return;
          const back = e.key === "Backspace" && input.value[start - 1] === ",";
          const forward = e.key === "Delete" && input.value[start] === ",";
          if (back || forward) {
            e.preventDefault();
            const at = back ? start - 2 : start + 1;
            apply(input.value.slice(0, at) + input.value.slice(at + 1), back ? at : start);
          }
        }}
      />
    </div>
  );
}
