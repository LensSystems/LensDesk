import { Button, ChevronDown, Input } from "@lensdesk/ui";
import { Check, Store } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { AccountSummary, ClientRecord } from "../shared/trading-contracts.ts";
import { accountStatus } from "./account-status.ts";
import { moneyText } from "./format.ts";
import { useCustomerPopup } from "./use-customer-popup.ts";

export function CustomerPicker({
  clients,
  accounts,
  value,
  onChange,
  onCreate,
  disabled,
  today,
}: {
  clients: ClientRecord[];
  accounts: AccountSummary[];
  value: string | null;
  onChange: (value: string | null) => void;
  onCreate: (query: string) => void;
  disabled: boolean;
  today: string;
}) {
  const { t, i18n } = useTranslation(),
    id = useId();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null),
    popup = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);
  const bounds = useCustomerPopup(open, root, popup, close);
  const selected = clients.find((c) => c.id === value)?.name ?? t("counter");
  const allChoices = [{ id: null, name: t("counter") }, ...clients.filter((c) => c.active)];
  const choices = allChoices.filter((c) =>
    c.name.toLocaleLowerCase(i18n.language).includes(query.toLocaleLowerCase(i18n.language)),
  );
  const choose = (clientId: string | null) => {
    close();
    onChange(clientId);
  };
  const create = () => {
    close();
    onCreate(query);
  };
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, id]);
  return (
    <div className="ventas-customer-picker" ref={root}>
      <Input
        label={t("client")}
        role="combobox"
        data-sale-client-search
        placeholder={t("searchClientShortcut")}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={id}
        aria-activedescendant={open && choices[active] ? `${id}-${active}` : undefined}
        value={open ? query : selected}
        disabled={disabled}
        autoComplete="off"
        onFocus={(event) => {
          if (event.currentTarget.dataset.saleRestoreFocus === "true") return;
          setQuery("");
          setActive(-1);
          setOpen(true);
        }}
        onClick={() => {
          if (!open) {
            setQuery("");
            setActive(-1);
            setOpen(true);
          }
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            if (!open) setQuery("");
            setOpen(true);
            const count = (open ? choices : allChoices).length;
            setActive((n) => {
              if (!count) return -1;
              if (e.key === "Home") return 0;
              if (e.key === "End") return count - 1;
              if (!open || n < 0) return e.key === "ArrowUp" ? count - 1 : 0;
              return (n + (e.key === "ArrowUp" ? -1 : 1) + count) % count;
            });
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            const c = choices[Math.max(0, active)];
            if (c) choose(c.id);
            else create();
          } else if (e.key === "Escape") {
            e.preventDefault();
            close();
          } else if (e.key === "Tab") close();
        }}
      />
      <ChevronDown className="ventas-picker-chevron" size={16} aria-hidden="true" />
      {open && bounds
        ? createPortal(
            <div
              className="ventas-customer-popup ventas-sale-customer-popup"
              ref={popup}
              style={{ position: "fixed", ...bounds }}
            >
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
                      <span className="ventas-customer-option-copy">
                        <strong>{c.name}</strong>
                        <small>
                          {a
                            ? `${t(`accountStatus.${accountStatus(a, today)}`)} · ${moneyText(a.balance, i18n.language)}`
                            : t("cashSale")}
                        </small>
                      </span>
                      {value === c.id ? <Check size={14} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
              {!choices.length ? <p role="status">{t("noMatchingClients")}</p> : null}
              <div className="ventas-customer-create">
                <Button onClick={create}>
                  <Store size={15} aria-hidden="true" />
                  {t("addClient")}
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
