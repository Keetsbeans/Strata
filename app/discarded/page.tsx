"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import { daysLeft, discardedLabel } from "@/lib/dates";
import { DISCARD_DAYS } from "@/lib/types";
import Icon from "@/components/Icon";
import Dialog from "@/components/Dialog";
import Mascot from "@/components/Mascot";
import { preview } from "@/components/ThoughtCard";

type Row = { key: string; id: string; kind: "thought" | "thread"; title: string; at: string; count?: number };

export default function Discarded() {
  const { store } = useApp();
  const router = useRouter();
  const { data, error, reload } = useData(() => store.discarded(), [store]);
  const [picked, setPicked] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);

  if (error) return <main className="screen no-nav"><p className="error">{error}</p></main>;
  if (!data) return <main className="screen no-nav" />;

  const rows: Row[] = [
    ...data.threads.map((t) => ({ key: "th:" + t.id, id: t.id, kind: "thread" as const, title: t.title, at: t.discarded_at!, count: t.count })),
    ...data.thoughts.map((t) => ({ key: "t:" + t.id, id: t.id, kind: "thought" as const, title: preview(t.body, 90), at: t.discarded_at! })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const chosen = rows.filter((r) => picked.includes(r.key));
  const split = () => ({
    thoughts: chosen.filter((r) => r.kind === "thought").map((r) => r.id),
    threads: chosen.filter((r) => r.kind === "thread").map((r) => r.id),
  });

  const restore = async () => {
    const s = split();
    if (s.threads.length) await store.restoreThreads(s.threads);
    if (s.thoughts.length) await store.restoreThoughts(s.thoughts);
    setPicked([]);
    reload();
  };
  const destroy = async () => {
    const s = split();
    if (s.threads.length) await store.deleteThreadsForever(s.threads);
    if (s.thoughts.length) await store.deleteThoughtsForever(s.thoughts);
    setPicked([]);
    setAsking(false);
    reload();
  };
  const all = picked.length === rows.length && rows.length > 0;

  return (
    <>
      <main className="screen no-nav" style={{ paddingBottom: 120, gap: 14 }}>
        <header className="between">
          <button className="icon-btn round" aria-label="Back" onClick={() => router.back()}>
            <Icon name="back" />
          </button>
          <h1 className="h-mid">Discarded</h1>
          <button className="btn sm" disabled={!rows.length} onClick={() => setPicked(all ? [] : rows.map((r) => r.key))}>
            {all ? "Clear" : "Select all"}
          </button>
        </header>
        <span className="muted" style={{ fontSize: 13 }}>
          Kept for {DISCARD_DAYS} days, then removed. Tick the thoughts or threads you want to restore or delete.
        </span>
        {rows.map((r) => {
          const on = picked.includes(r.key);
          return (
            <button
              key={r.key}
              role="checkbox"
              aria-checked={on}
              className="drow"
              data-on={on}
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== r.key) : [...p, r.key]))}
            >
              <span className={"tick" + (on ? " on" : "")} style={{ position: "static", margin: 0, flex: "0 0 24px" }} aria-hidden="true">
                {on && <Icon name="check" size={14} color="#FBFAF7" width={3} />}
              </span>
              <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
                {r.kind === "thread" && (
                  <span className="tag butter" style={{ alignSelf: "flex-start", fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>
                    Thread · {r.count} {r.count === 1 ? "thought" : "thoughts"}
                  </span>
                )}
                <span className={r.kind === "thread" ? "" : "serif"} style={{ fontSize: 17, lineHeight: 1.3, fontWeight: r.kind === "thread" ? 600 : 400 }}>
                  {r.title}
                </span>
                <span className="small muted">
                  {discardedLabel(r.at)} · {daysLeft(r.at, DISCARD_DAYS)} days left
                </span>
              </span>
            </button>
          );
        })}
        {rows.length === 0 && (
          <div className="empty">
            <Mascot size={72} eyes="closed" mouth="smile" />
            <h2>Nothing discarded</h2>
            <p>Thoughts and threads you discard wait here for {DISCARD_DAYS} days in case you change your mind.</p>
          </div>
        )}
      </main>
      {rows.length > 0 && (
        <div className="bar">
          <strong className="grow" style={{ fontWeight: 600, fontSize: 15 }}>{picked.length} selected</strong>
          <button className="btn" disabled={!picked.length} onClick={restore}>
            Restore
          </button>
          <button className="btn ink" disabled={!picked.length} onClick={() => setAsking(true)}>
            Delete for ever
          </button>
        </div>
      )}
      {asking && (
        <Dialog
          title={`Delete ${picked.length === 1 ? "this" : `these ${picked.length}`} for ever?`}
          body="This can't be undone. They will be gone from every device."
          face="worried"
          onClose={() => setAsking(false)}
          actions={
            <>
              <button className="btn ink block" onClick={destroy}>
                Delete for ever
              </button>
              <button className="btn block" onClick={() => setAsking(false)}>
                Keep them
              </button>
            </>
          }
        />
      )}
    </>
  );
}
