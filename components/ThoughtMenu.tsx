"use client";
import { useEffect, useState } from "react";
import type { Thought } from "@/lib/types";
import type { Store } from "@/lib/store/types";
import { putInThread } from "@/lib/threads";
import Icon from "./Icon";
import ThreadPicker from "./ThreadPicker";
import { WordLinkPicker } from "./Pickers";
import { preview } from "./ThoughtCard";

/** what press-and-hold on a thought opens: add it to a thread, pin it to a film or book, or discard it */
export default function ThoughtMenu({ store, thought, onDone, onClose, extra }: { store: Store; thought: Thought; onDone: (note: string, discarded?: boolean) => void; onClose: () => void; extra?: { label: string; icon: string; run: () => void } }) {
  const [step, setStep] = useState<"" | "thread" | "pin">("");
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  if (step === "thread")
    return (
      <ThreadPicker
        store={store}
        thought={thought}
        onClose={onClose}
        onPick={async (tid) => {
          await putInThread(store, thought, tid);
          const th = await store.thread(tid);
          onDone(`Added to “${th?.title ?? "the thread"}”.`);
        }}
      />
    );
  if (step === "pin")
    return (
      <WordLinkPicker
        store={store}
        word=""
        whole
        onClose={onClose}
        onPick={async (kind, target) => {
          if (kind === "collection") {
            await store.updateThought(thought.id, { collection_id: target });
            const c = await store.collection(target);
            onDone(`Added to “${c?.title ?? "the collection"}”.`);
          } else {
            await store.updateThought(thought.id, { interest_id: target });
            const it = await store.interest(target);
            onDone(`Added to ${it?.title ?? "it"}.`);
          }
        }}
      />
    );
  return (
    <>
      <div className="scrim fade" onClick={onClose} />
      <div className="dialog quick-menu" role="dialog" aria-modal="true" aria-label="Thought options">
        <p className="serif" style={{ color: "var(--ink)", fontSize: 16, margin: 0 }}>“{preview(thought.body, 80)}”</p>
        <div className="stack" style={{ gap: 6 }}>
          <button className="qm-row" onClick={() => setStep("thread")}>
            <Icon name="thread" size={18} /> Add to a thread
          </button>
          <button className="qm-row" onClick={() => setStep("pin")}>
            <Icon name="link" size={18} /> Add to a collection
          </button>
          {extra && (
            <button className="qm-row" onClick={extra.run}>
              <Icon name={extra.icon} size={18} /> {extra.label}
            </button>
          )}
          <button
            className="qm-row danger"
            onClick={async () => {
              await store.discardThoughts([thought.id]);
              onDone("Moved to Discarded.", true);
            }}
          >
            <Icon name="trash" size={18} /> Discard
          </button>
        </div>
        <button className="btn block" onClick={onClose}>Cancel</button>
      </div>
    </>
  );
}
