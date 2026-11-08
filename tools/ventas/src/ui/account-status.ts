import { addDays } from "../shared/calendar.ts";
import type { Snapshot } from "../shared/contracts.ts";
export type AccountFilter = "all" | "attention" | "clear";
export type AccountsState = { selected: string | null; query: string; filter: AccountFilter };
export function accountStatus(account: Snapshot["accounts"][number] | undefined, today: string) {
  if (!account?.balance) return "clear";
  if (account.overdue > 0) return "overdue";
  if (account.nextDue && account.nextDue <= addDays(today, 3)) return "soon";
  return "current";
}
export function visibleAccounts(data: Snapshot, state: AccountsState, locale: string) {
  const accounts = new Map(data.accounts.map((a) => [a.clientId, a]));
  return data.clients.filter((c) => {
    const a = accounts.get(c.id),
      status = accountStatus(a, data.today);
    return (
      c.name.toLocaleLowerCase(locale).includes(state.query.toLocaleLowerCase(locale)) &&
      (state.filter === "all" ||
        (state.filter === "clear"
          ? status === "clear"
          : status !== "clear" && status !== "current"))
    );
  });
}
