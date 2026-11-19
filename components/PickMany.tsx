"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

export type PickItem = { id: string; title: string; sub?: string; serif?: boolean; done?: string };

/** bottom sheet: tick one or more things, then confirm */
export default function PickMany({
  title,
  intro,
  items,
  find = "Find",
  empty,
  confirm,
  onDone,
  onClose,
}: {
  title: string;
  intro?: string;
  items: PickItem[];
  find?: string;
  empty: string;
  confirm: (n: number) => string;
  onDone: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [on, setOn] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const term = q.trim().toLowerCase();
  const shown = items.filter((i) => !term || (i.title + " " + (i.sub ?? "")).toLowerCase().includes(term)).slice(0, 60);
  const flip = (id: string) => setOn((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} ref={ref} style={{ maxHeight: "86dvh", overflowY: "auto" }}>
        <h2>{title}</h2>
        {intro && <p>{intro}</p>}
        {items.length > 5 && <input className="input" placeholder={find} aria-label={find} value={q} onChange={(e) => setQ(e.target.value)} />}
        <div className="stack" style={{ gap: 8 }}>
          {shown.map((i) => (
            <button
              key={i.id}
              type="button"
              role="checkbox"
              aria-checked={on.includes(i.id)}
              disabled={!!i.done}
              className="choice box"
              onClick={() => flip(i.id)}
            >
              <span className="dot" aria-hidden="true">{on.includes(i.id) && <Icon name="check" size={14} width={2.4} />}</span>
              <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                <strong className={i.serif ? "serif" : ""} style={i.serif ? { fontSize: 16, fontWeight: 400, lineHeight: 1.3 } : { fontSize: 15, fontWeight: 600 }}>{i.title}</strong>
                {(i.done || i.sub) && <span className="small muted">{i.done ?? i.sub}</span>}
              </span>
            </button>
          ))}
          {items.length === 0 && <span className="muted">{empty}</span>}
        </div>
        <div className="stack" style={{ gap: 10, marginTop: 4 }}>
          <button className="btn ink block" disabled={!on.length} onClick={() => onDone(on)}>
            {confirm(on.length || 1)}
          </button>
          <button className="link" style={{ fontWeight: 500 }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </>
  );
}
