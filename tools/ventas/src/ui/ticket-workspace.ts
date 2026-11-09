import type { PaymentForm } from "./PaymentFields.tsx";
import type { Period } from "./PeriodControls.tsx";

export type TicketWorkspace = {
  initialized: boolean;
  autoSelect: boolean;
  query: { search: string; period: Period; offset: number };
  selected: string | null;
  review: boolean;
  clientId: string | null;
  bankId: string | null;
  payment: PaymentForm | null;
};
export type WorkspaceProps = {
  workspace: TicketWorkspace;
  onWorkspace: (state: TicketWorkspace) => void;
};
export const emptyWorkspace: TicketWorkspace = {
  initialized: false,
  autoSelect: true,
  query: { search: "", period: "all", offset: 0 },
  selected: null,
  review: false,
  clientId: null,
  bankId: null,
  payment: null,
};
