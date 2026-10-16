import { Component, type ReactNode } from "react";

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
      <main className="grid min-h-screen place-content-center gap-3 bg-bg p-4 text-text">
        <h1 className="text-[15px] font-medium">{this.props.title}</h1>
        <p className="text-muted">{this.props.description}</p>
        <button
          className="h-7 rounded bg-accent px-3 text-accent-fg"
          onClick={() => location.reload()}
          type="button"
        >
          {this.props.reloadLabel}
        </button>
      </main>
    );
  }
}
