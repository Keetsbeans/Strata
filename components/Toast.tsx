"use client";
import { useEffect, useRef } from "react";

/**
 * A short pop-up at the bottom: says what just happened, offers one action (Undo, Add to a thread…),
 * and leaves on its own after 5 seconds. A bar along the bottom runs down so you can see how long is left.
 */
export const TOAST_MS = 5000;

export default function Toast({
  title,
  line,
  sub,
  onUndo,
  action,
  onDone,
  ms = TOAST_MS,
}: {
  title: string;
  line?: string;
  sub?: string;
  onUndo?: () => void;
  action?: { label: string; onClick: () => void };
  onDone: () => void;
  ms?: number;
}) {
  const done = useRef(onDone);
  done.current = onDone;
  // the clock starts when the pop-up appears and only restarts for a new message
  useEffect(() => {
    const t = setTimeout(() => done.current(), ms);
    return () => clearTimeout(t);
  }, [ms, title, line]);
  const act = action ?? (onUndo ? { label: "Undo", onClick: onUndo } : null);
  return (
    <div className="toast" role="status" key={title + (line ?? "")}>
      <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
        <strong style={{ fontWeight: 600, fontSize: 15 }}>{title}</strong>
        {line && <span className="serif" style={{ fontSize: 15, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line}</span>}
        {sub && <span style={{ fontSize: 12, color: "var(--on-dark)" }}>{sub}</span>}
      </span>
      {act && (
        <button className="btn" onClick={() => (act.onClick(), done.current())}>
          {act.label}
        </button>
      )}
      <span className="toast-time" aria-hidden="true" style={{ animationDuration: `${ms}ms` }} />
    </div>
  );
}
