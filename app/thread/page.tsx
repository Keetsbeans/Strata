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
import PickMany from "@/components/PickMany";
import { preview } from "@/components/ThoughtCard";
import { timeline } from "@/lib/threads";

function ThreadView() {
  const { store } = useApp();
  const router = useRouter();
  const id = useSearchParams().get("id") || "";
  const { data, error, reload } = useData(async () => {
    const [thread, all, links, threads] = await Promise.all([store.thread(id), store.thoughts(), store.threadLinks(), store.threads()]);
    const entries = thread ? timeline(thread, all, links) : [];
    const titles = new Map(threads.map((x) => [x.id, x.title]));
    const here = new Set(entries.map((e) => e.thought.id));
    const elsewhere = all
      .filter((t) => t.finished && !here.has(t.id))
      .map((t) => ({ id: t.id, title: preview(t.body, 90), serif: true, sub: `${day(t.created_at, { weekday: false })}${t.thread_id && titles.get(t.thread_id) ? ` · in ${titles.get(t.thread_id)}` : ""}` }));
    return { thread, entries, titles, elsewhere, every: all.filter((t) => t.thread_id === id) };
  }, [store, id]);
  const [asking, setAsking] = useState(false);
  const [keep, setKeep] = useState(true);
  const [editing, setEditing] = useState<null | { title: string; note: string }>(null);
  const [linking, setLinking] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  if (error) return <main className="screen no-nav"><p className="error">{error}</p></main>;
  if (!data) return <main className="screen no-nav" />;
  const { thread, entries, titles, elsewhere, every } = data;
  if (!thread || thread.discarded_at)
    return (
      <main className="screen no-nav">
        <p className="error">This thread isn&apos;t here any more. It may be in Discarded.</p>
        <Link className="btn" href="/threads/">Back to threads</Link>
      </main>
    );
  const own = entries.filter((e) => !e.link);
  const n = own.length;
  const linked = entries.length - n;
  const first = own[0]?.thought;

  const exportText = () => {
    const text =
      `${thread.title}\n\n` +
      (thread.note ? thread.note + "\n\n" : "") +
      entries.map(({ thought: t, link }) => `${day(t.created_at)}, ${time(new Date(t.created_at))}${link ? " (linked)" : ""}\n${t.body}`).join("\n\n");
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
  const saveEdit = async () => {
    if (!editing?.title.trim()) return;
    await store.updateThread(thread.id, { title: editing.title.trim().slice(0, 200), note: editing.note.trim().slice(0, 500) });
    setEditing(null);
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
          <button className="btn sm" onClick={() => setEditing({ title: thread.title, note: thread.note ?? "" })}>
            Edit
          </button>
          <button className="icon-btn" aria-label="Delete this thread" onClick={() => setAsking(true)}>
            <Icon name="trash" size={18} width={2} />
          </button>
        </div>
      </header>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="h-title">{thread.title}</h1>
        {thread.note && <p className="serif" style={{ margin: 0, fontSize: 17, lineHeight: 1.35 }}>{thread.note}</p>}
      </div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <button
          className={"tag" + (thread.state === "ongoing" ? " butter" : "")}
          onClick={async () => (await store.updateThread(thread.id, { state: thread.state === "ongoing" ? "resting" : "ongoing" }), reload())}
          aria-label={`${thread.state === "ongoing" ? "Ongoing" : "Resting"}. Tap to change`}
        >
          {thread.state === "ongoing" ? "Ongoing" : "Resting"}
        </button>
        <span className="muted" style={{ fontSize: 13 }}>
          {n} {n === 1 ? "thought" : "thoughts"}
          {linked ? ` · ${linked} linked` : ""}
          {first ? ` · started ${day(first.created_at, { weekday: false })}` : ""}
        </span>
      </div>
      <PickUpRow thoughts={every} onViewMore={() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
      <ol className="timeline" ref={listRef} style={{ scrollMarginTop: 16 }}>
        {entries.map(({ thought: t, root, link }) => (
          <li key={link?.id ?? t.id}>
            <span className={"tl-dot" + (root ? " root" : link ? " open" : "")} aria-hidden="true" />
            <div className={"card stack" + (link ? " tl-branch" : "")} style={{ gap: 4, borderRadius: 10, position: "relative", ...(root ? { boxShadow: "3px 3px 0 var(--lilac)" } : {}) }}>
              {root && <span className="tl-label">Started here</span>}
              {link && (
                <span className="row" style={{ gap: 6, alignItems: "center" }}>
                  <span className="tl-label grow">Linked from: {t.thread_id && titles.get(t.thread_id) ? titles.get(t.thread_id) : "a thought on its own"}</span>
                  <button className="icon-btn" style={{ border: 0, background: "transparent", margin: "-10px -10px -10px 0" }} aria-label="Take this link out" onClick={async () => (await store.unlink(link.id), reload())}>
                    <Icon name="close" size={14} />
                  </button>
                </span>
              )}
              <Link href={`/thought/?id=${t.id}`} className="stack" style={{ gap: 4, textDecoration: "none" }}>
                <span className="small muted">
                  <strong style={{ color: "var(--ink)" }}>{day(t.created_at)}</strong> · {link ? "tap to open the original" : time(new Date(t.created_at))}
                </span>
                <span className="serif" style={{ fontSize: 17, lineHeight: 1.35, whiteSpace: "pre-wrap" }}>{link ? preview(t.body, 220) : t.body}</span>
              </Link>
            </div>
          </li>
        ))}
        <li className="add">
          <span className="tl-dot open" aria-hidden="true" />
          <div className="stack" style={{ gap: 6 }}>
            <Link href={`/write/?thread=${thread.id}`} className="btn block dashed" style={{ fontWeight: 500, minHeight: 46 }}>
              Add a follow-up
            </Link>
            <button className="link small" style={{ minHeight: 40 }} onClick={() => setLinking(true)}>
              Link a thought from elsewhere
            </button>
          </div>
        </li>
      </ol>
      {editing && (
        <Dialog
          title="Edit thread"
          onClose={() => setEditing(null)}
          actions={
            <>
              <button className="btn ink block" disabled={!editing.title.trim()} onClick={saveEdit}>Save</button>
              <button className="btn block" onClick={exportText} disabled={!entries.length}>Export as text</button>
              <button className="link" style={{ fontWeight: 500 }} onClick={() => setEditing(null)}>Cancel</button>
            </>
          }
        >
          <div className="stack" style={{ gap: 8 }}>
            <input className="input" aria-label="Thread name" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <textarea className="input" rows={3} aria-label="A note about this thread" placeholder="A note about what this thread follows (optional)" value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} style={{ resize: "none", paddingTop: 12 }} />
          </div>
        </Dialog>
      )}
      {linking && (
        <PickMany
          title="Link a thought here"
          intro="It shows here on its own little branch. Nothing is copied, and the thought stays where it is."
          items={elsewhere}
          find="Find a thought"
          empty="No other thoughts to link yet."
          confirm={(k) => `Link ${k} ${k === 1 ? "thought" : "thoughts"}`}
          onClose={() => setLinking(false)}
          onDone={async (ids) => {
            for (const x of ids) await store.linkToThreads(x, [thread.id]);
            setLinking(false);
            reload();
          }}
        />
      )}
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
