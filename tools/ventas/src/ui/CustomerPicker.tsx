import { Button, ChevronDown, Input } from "@lensdesk/ui";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Account, ClientRecord } from "../shared/trading-contracts.ts";
import { moneyText } from "./format.ts";

export function CustomerPicker({
  clients,
  accounts,
  value,
  onChange,
  onCreate,
  disabled,
}: {
  clients: ClientRecord[];
  accounts: Account[];
  value: string | null;
  onChange: (value: string | null) => void;
  onCreate: () => void;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation(),
    id = useId();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const selected = clients.find((c) => c.id === value)?.name ?? t("counter");
  const choices = [{ id: null, name: t("counter") }, ...clients.filter((c) => c.active)].filter(
    (c) => c.name.toLocaleLowerCase(i18n.language).includes(query.toLocaleLowerCase(i18n.language)),
  );
  const choose = (clientId: string | null) => {
    setOpen(false);
    onChange(clientId);
  };
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, id]);
  return (
    <div className="ventas-customer-picker" ref={root}>
      <Input
        label={t("client")}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={id}
        aria-activedescendant={open && choices[active] ? `${id}-${active}` : undefined}
        value={open ? query : selected}
        disabled={disabled}
        autoComplete="off"
        onFocus={() => {
          setQuery("");
          setActive(0);
          setOpen(true);
        }}
        onClick={() => {
          if (!open) {
            setQuery("");
            setActive(0);
            setOpen(true);
          }
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            if (!open) setQuery("");
            setOpen(true);
            setActive((n) =>
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? Math.max(0, choices.length - 1)
                  : (n + (e.key === "ArrowUp" ? -1 : 1) + choices.length) %
                    Math.max(1, choices.length),
            );
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            const c = choices[active];
            if (c) choose(c.id);
            else onCreate();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
          } else if (e.key === "Tab") setOpen(false);
        }}
      />
      <ChevronDown className="ventas-picker-chevron" size={16} aria-hidden="true" />
      {open ? (
        <div className="ventas-customer-popup">
          <div role="listbox" id={id} aria-label={t("clients")}>
            {choices.map((c, index) => {
              const a = accounts.find((a) => a.clientId === c.id);
              return (
                <button
                  type="button"
                  role="option"
                  id={`${id}-${index}`}
                  key={c.id ?? "counter"}
                  aria-selected={value === c.id}
                  data-active={index === active}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => choose(c.id)}
                >
                  <strong>{c.name}</strong>
                  <small>{a ? moneyText(a.balance, i18n.language) : t("cashSale")}</small>
                </button>
              );
            })}
          </div>
          {!choices.length ? <p role="status">{t("noMatchingClients")}</p> : null}
          <Button
            onClick={() => {
              setOpen(false);
              onCreate();
            }}
          >
            {t("addClient")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
