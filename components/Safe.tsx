"use client";
import { Component, type ReactNode } from "react";

/** if something inside breaks, show a calm note with a way back instead of losing the whole page */
export default class Safe extends Component<{ children: ReactNode; label: string; onReset?: () => void }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  render() {
    if (!this.state.broken) return this.props.children;
    return (
      <div className="empty" role="alert">
        <h2>The {this.props.label} hiccuped</h2>
        <p>Nothing you saved is lost.</p>
        <button
          className="btn sm ink"
          onClick={() => {
            this.props.onReset?.();
            this.setState({ broken: false });
          }}
        >
          Show it again
        </button>
      </div>
    );
  }
}
