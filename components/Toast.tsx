"use client";
import { useEffect } from "react";

export default function Toast({ title, line, sub, onUndo, onDone, ms = 7000 }: { title: string; line?: string; sub?: string; onUndo?: () => void; onDone: () => void; ms?: number }) {
  useEffect(() => {
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [onDone, ms]);
  return (
    <div className="toast" role="status">
      <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
        <strong style={{ fontWeight: 600, fontSize: 15 }}>{title}</strong>
        {line && <span className="serif" style={{ fontSize: 15, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line}</span>}
        {sub && <span style={{ fontSize: 12, color: "var(--on-dark)" }}>{sub}</span>}
      </span>
      {onUndo && (
        <button className="btn" onClick={onUndo}>
          Undo
        </button>
      )}
    </div>
  );
}
