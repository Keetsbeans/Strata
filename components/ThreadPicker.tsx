"use client";
import { useEffect, useState } from "react";
import type { Thought, Thread } from "@/lib/types";
import type { Store } from "@/lib/store/types";
import { rootOf } from "@/lib/threads";
import { preview } from "./ThoughtCard";

/** bottom sheet: which thread should this go under? Or start a new one from it. */
export default function ThreadPicker({ store, onPick, onClose, count = 1, thought }: { store: Store; onPick: (threadId: string) => void; onClose: () => void; count?: number; thought?: Thought }) {
  const [threads, setThreads] = useState<{ t: Thread; sub: string }[] | null>(null);
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    Promise.all([store.threads(), store.thoughts()]).then(([ths, all]) =>
      setThreads(
        ths.map((t) => {
          const root = rootOf(t, all);
          const n = all.filter((x) => x.thread_id === t.id && x.finished).length;
          return { t, sub: `${root ? `Starts: “${preview(root.body, 34)}” · ` : ""}${n} ${n === 1 ? "thought" : "thoughts"}` };
        }),
      ),
    );
  }, [store]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const t = thought && !thought.thread_id ? await store.startThread(thought.id, name.trim().slice(0, 200)) : await store.addThread(name.trim().slice(0, 200));
    onPick(t.id);
  };
  const term = q.trim().toLowerCase();
  const shown = threads?.filter((x) => !term || (x.t.title + x.sub).toLowerCase().includes(term));
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Put it in a thread" style={{ maxHeight: "84dvh", overflowY: "auto" }}>
        <h2>Which thread should {count === 1 ? "this" : `these ${count}`} go under?</h2>
        {thought && <p className="serif" style={{ color: "var(--ink)", fontSize: 16 }}>“{preview(thought.body, 90)}”</p>}
        {threads && threads.length > 5 && <input className="input" placeholder="Find a thread" aria-label="Find a thread" value={q} onChange={(e) => setQ(e.target.value)} />}
        <div className="stack" style={{ gap: 8 }}>
          {shown?.map(({ t, sub }) => {
            const here = thought?.thread_id === t.id;
            return (
              <button key={t.id} className="card stack" style={{ textAlign: "left", gap: 2, padding: "10px 14px" }} disabled={here} onClick={() => onPick(t.id)}>
                <strong style={{ fontWeight: 600, fontSize: 15 }}>{t.title}</strong>
                <span className="small muted">{here ? "It's in this one already" : sub}</span>
              </button>
            );
          })}
          {threads?.length === 0 && <span className="muted small">No threads yet. Start the first one below.</span>}
        </div>
        {thought?.thread_id && <span className="small muted">It stays where it is and shows in the thread you pick as a link.</span>}
        <form className="stack" style={{ gap: 8 }} onSubmit={create}>
          <label className="small" style={{ fontWeight: 600 }} htmlFor="new-thread">
            {thought && !thought.thread_id ? "Or start a new thread from it" : "Or start a new thread"}
          </label>
          <div className="row">
            <input id="new-thread" className="input" placeholder="Name the idea, like On routine" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn sm ink" disabled={!name.trim()}>Start</button>
          </div>
        </form>
        <button className="link" style={{ fontWeight: 500 }} onClick={onClose}>Cancel</button>
      </div>
    </>
  );
}
