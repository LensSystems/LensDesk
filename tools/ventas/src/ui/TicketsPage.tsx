import { useState } from "react";
import { TicketWorkspaceView } from "./TicketWorkspaceView.tsx";
import { emptyWorkspace, type WorkspaceProps } from "./ticket-workspace.ts";
import type { ScreenProps } from "./types.ts";

export function TicketsPage({
  workspace,
  onWorkspace,
  initialClientId,
  onBack = () => {},
  ...props
}: ScreenProps &
  Partial<WorkspaceProps> & {
    initialClientId?: string;
    onBack?: () => void;
    focusRequested?: boolean;
    onFocused?: () => void;
  }) {
  const [local, setLocal] = useState(() => ({
    ...emptyWorkspace,
    clientId: initialClientId ?? null,
  }));
  return (
    <TicketWorkspaceView
      {...props}
      workspace={workspace ?? local}
      onWorkspace={onWorkspace ?? setLocal}
      onBack={onBack}
    />
  );
}
