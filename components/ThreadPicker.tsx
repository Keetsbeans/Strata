"use client";
import { useEffect, useState } from "react";
import type { Thread } from "@/lib/types";
import type { Store } from "@/lib/store/types";

/** bottom sheet: pick a thread, or start a new one */
export default function ThreadPicker({ store, onPick, onClose, count = 1 }: { store: Store; onPick: (threadId: string) => void; onClose: () => void; count?: number }) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    store.threads().then(setThreads);
  }, [store]);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const t = await store.addThread(name.trim().slice(0, 200));
    onPick(t.id);
  };
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Add to a thread" style={{ maxHeight: "80dvh", overflowY: "auto" }}>
        <h2>Add {count === 1 ? "it" : `${count} thoughts`} to a thread</h2>
        <p>A thread follows one idea over time.</p>
        <div className="stack" style={{ gap: 8 }}>
          {threads?.map((t) => (
            <button key={t.id} className="card" style={{ textAlign: "left", fontWeight: 600, fontSize: 16 }} onClick={() => onPick(t.id)}>
              {t.title}
            </button>
          ))}
          {threads?.length === 0 && <span className="muted">No threads yet. Name your first one below.</span>}
        </div>
        <form className="stack" style={{ gap: 8 }} onSubmit={create}>
          <label className="small" style={{ fontWeight: 600 }}>
            Or start a new thread
          </label>
          <div className="row">
            <input className="input" placeholder="Name the idea, like On routine" value={name} onChange={(e) => setName(e.target.value)} style={{ minHeight: 48 }} />
            <button className="btn ink" disabled={!name.trim()}>
              Start
            </button>
          </div>
        </form>
        <button className="btn block" onClick={onClose}>
          Cancel
        </button>
      </div>
    </>
  );
}
