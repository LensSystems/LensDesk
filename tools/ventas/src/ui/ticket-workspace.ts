import type { PaymentForm } from "./PaymentFields.tsx";

export type TicketWorkspace = {
  initialized: boolean;
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
  selected: null,
  review: false,
  clientId: null,
  bankId: null,
  payment: null,
};
