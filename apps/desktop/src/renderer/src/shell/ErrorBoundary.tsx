import { Button, RotateCw, TriangleAlert } from "@lensdesk/ui";
import { Component, type ReactNode } from "react";
import { HEADER_HEIGHT } from "../../../shared/layout.ts";

type Props = { children: ReactNode; title: string; description: string; reloadLabel: string };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main
        className="relative grid min-h-screen place-items-center bg-bg p-4 text-text"
        style={{ paddingTop: HEADER_HEIGHT }}
      >
        <div
          aria-hidden="true"
          className="ld-drag absolute inset-x-0 top-0"
          style={{ height: HEADER_HEIGHT }}
        />
        <div className="flex w-full max-w-100 flex-col items-center gap-4 text-center">
          <div
            aria-hidden="true"
            className="grid size-16 shrink-0 place-items-center rounded-ld-xl bg-danger-soft text-danger"
          >
            <TriangleAlert size={30} strokeWidth={1.6} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold">{this.props.title}</h1>
            <p className="text-muted">{this.props.description}</p>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => location.reload()}
            type="button"
          >
            <RotateCw size={16} aria-hidden="true" />
            {this.props.reloadLabel}
          </Button>
        </div>
      </main>
    );
  }
}
