"use client";
import { Component, Fragment, type ReactNode } from "react";

/**
 * If something inside breaks, quietly start it fresh. Only if it keeps breaking (3 times in 10 seconds)
 * show a calm note with a way back, and the reason in small print so it can be reported.
 */
export default class Safe extends Component<{ children: ReactNode; label: string; onReset?: () => void }, { broken: boolean; round: number; why: string }> {
  state = { broken: false, round: 0, why: "" };
  fails: number[] = [];
  static getDerivedStateFromError(error: unknown) {
    return { broken: true, why: error instanceof Error ? error.message : String(error) };
  }
  componentDidCatch(error: Error) {
    console.error("[strata] " + this.props.label + " broke: " + (error?.message ?? error));
    const now = Date.now();
    this.fails = [...this.fails.filter((t) => now - t < 10000), now];
    if (this.fails.length < 3) this.setState((s) => ({ broken: false, round: s.round + 1 }));
  }
  render() {
    if (!this.state.broken) return <Fragment key={this.state.round}>{this.props.children}</Fragment>;
    return (
      <div className="empty" role="alert" style={{ margin: "auto 16px" }}>
        <h2>The {this.props.label} hiccuped</h2>
        <p>Nothing you saved is lost.</p>
        <button
          className="btn sm ink"
          onClick={() => {
            this.fails = [];
            this.props.onReset?.();
            this.setState((s) => ({ broken: false, round: s.round + 1 }));
          }}
        >
          Show it again
        </button>
        {this.state.why && <p className="small muted" style={{ fontSize: 11, marginTop: 6 }}>Reason: {this.state.why.slice(0, 160)}</p>}
      </div>
    );
  }
}
