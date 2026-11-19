"use client";
import Link from "next/link";
import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import { day, time } from "@/lib/dates";
import Icon from "@/components/Icon";
import Dialog, { Choice } from "@/components/Dialog";
import PickUpRow from "@/components/PickUpRow";

function ThreadView() {
  const { store } = useApp();
  const router = useRouter();
  const id = useSearchParams().get("id") || "";
  const { data, error, reload } = useData(async () => {
    const [thread, all] = await Promise.all([store.thread(id), store.thoughts()]);
    return { thread, inside: all.filter((t) => t.thread_id === id && t.finished), every: all.filter((t) => t.thread_id === id) };
  }, [store, id]);
  const [asking, setAsking] = useState(false);
  const [keep, setKeep] = useState(true);
  const [renaming, setRenaming] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  if (error) return <main className="screen no-nav"><p className="error">{error}</p></main>;
  if (!data) return <main className="screen no-nav" />;
  const { thread, inside, every } = data;
  if (!thread || thread.discarded_at)
    return (
      <main className="screen no-nav">
        <p className="error">This thread isn&apos;t here any more. It may be in Discarded.</p>
        <Link className="btn" href="/threads/">Back to threads</Link>
      </main>
    );
  const first = inside[inside.length - 1];
  const n = inside.length;

  const exportText = () => {
    const text =
      `${thread.title}\n\n` +
      [...inside].reverse().map((t) => `${day(t.created_at)}, ${time(new Date(t.created_at))}\n${t.body}`).join("\n\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = thread.title.replace(/[^\w\- ]+/g, "").trim() + ".txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const del = async () => {
    await store.discardThread(thread.id, keep);
    router.replace("/threads/");
  };
  const rename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renaming?.trim()) return;
    await store.updateThread(thread.id, { title: renaming.trim().slice(0, 200) });
    setRenaming(null);
    reload();
  };

  return (
    <main className="screen no-nav">
      <header className="between">
        <Link href="/threads/" className="icon-btn round" aria-label="Back to threads">
          <Icon name="back" />
        </Link>
        <span className="h-mid" style={{ fontWeight: 600 }}>Thread</span>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm" onClick={exportText} disabled={!n}>
            Export
          </button>
          <button className="icon-btn" aria-label="Delete this thread" onClick={() => setAsking(true)}>
            <Icon name="trash" size={18} width={2} />
          </button>
        </div>
      </header>
      {renaming !== null ? (
        <form className="stack" style={{ gap: 8 }} onSubmit={rename}>
          <input className="input" autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} aria-label="Thread name" style={{ fontSize: 20, fontWeight: 600 }} />
          <div className="row">
            <button type="button" className="btn sm grow" onClick={() => setRenaming(null)}>Cancel</button>
            <button className="btn sm ink grow">Rename</button>
          </div>
        </form>
      ) : (
        <button className="h-title" style={{ background: "none", border: 0, padding: 0, textAlign: "left", fontWeight: 600 }} onClick={() => setRenaming(thread.title)} aria-label={`${thread.title}. Tap to rename`}>
          {thread.title}
        </button>
      )}
      <div className="row">
        <button
          className={"tag" + (thread.state === "ongoing" ? " butter" : "")}
          style={{ minHeight: 32 }}
          onClick={async () => (await store.updateThread(thread.id, { state: thread.state === "ongoing" ? "resting" : "ongoing" }), reload())}
          aria-label={`${thread.state === "ongoing" ? "Ongoing" : "Resting"}. Tap to change`}
        >
          {thread.state === "ongoing" ? "Ongoing" : "Resting"}
        </button>
        <span className="muted" style={{ fontSize: 13 }}>
          {n} {n === 1 ? "thought" : "thoughts"}
          {first ? ` · started ${day(first.created_at, { weekday: false })}` : ""}
        </span>
      </div>
      <PickUpRow thoughts={every} onViewMore={() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
      <ol className="timeline" ref={listRef} style={{ scrollMarginTop: 16 }}>
        {inside.map((t) => (
          <li key={t.id}>
            <span className="tl-dot" aria-hidden="true" />
            <Link href={`/thought/?id=${t.id}`} className="card stack" style={{ gap: 4, textDecoration: "none", borderRadius: 10 }}>
              <span className="small muted">
                <strong style={{ color: "var(--ink)" }}>{day(t.created_at)}</strong> · {time(new Date(t.created_at))}
              </span>
              <span className="serif" style={{ fontSize: 17, lineHeight: 1.35, whiteSpace: "pre-wrap" }}>{t.body}</span>
            </Link>
          </li>
        ))}
        <li className="add">
          <span className="tl-dot open" aria-hidden="true" />
          <Link href={`/write/?thread=${thread.id}`} className="btn block dashed" style={{ fontWeight: 500 }}>
            Add to this thread
          </Link>
        </li>
      </ol>
      {asking && (
        <Dialog
          title="Delete this thread?"
          body={`A thread only ties thoughts together. Choose what happens to the ${n} ${n === 1 ? "thought" : "thoughts"} inside it.`}
          face="worried"
          onClose={() => setAsking(false)}
          actions={
            <>
              <button className="btn ink block" onClick={del}>
                Delete thread
              </button>
              <button className="btn block" onClick={() => setAsking(false)}>
                Keep it
              </button>
            </>
          }
        >
          <div role="radiogroup" aria-label="What happens to the thoughts" className="stack" style={{ gap: 8 }}>
            <Choice on={keep} title="Keep the thoughts" sub={`Only the thread goes. The ${n} ${n === 1 ? "thought stays" : "thoughts stay"} in your list.`} onClick={() => setKeep(true)} />
            <Choice on={!keep} title="Discard the thoughts too" sub={`The thread and its ${n} ${n === 1 ? "thought" : "thoughts"} all move to Discarded.`} onClick={() => setKeep(false)} />
          </div>
          <span className="muted" style={{ fontSize: 13 }}>Either way it waits in Discarded for 30 days and can be restored whole.</span>
        </Dialog>
      )}
    </main>
  );
}

export default function ThreadPage() {
  return (
    <Suspense>
      <ThreadView />
    </Suspense>
  );
}
