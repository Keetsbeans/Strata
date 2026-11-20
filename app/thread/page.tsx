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
import { putInThread, timeline } from "@/lib/threads";
import Topics from "@/components/Topics";
import type { Thought } from "@/lib/types";
import ThoughtMenu from "@/components/ThoughtMenu";
import { useLongPress } from "@/lib/longpress";

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
    const labels = [...new Set(threads.flatMap((x) => x.labels ?? []))].sort();
    return { thread, entries, titles, elsewhere, labels, all, every: all.filter((t) => t.thread_id === id) };
  }, [store, id]);
  const [asking, setAsking] = useState(false);
  const [keep, setKeep] = useState(true);
  const [editing, setEditing] = useState<null | { title: string; note: string; labels: string[] }>(null);
  const [linking, setLinking] = useState(false);
  const [menu, setMenu] = useState<Thought | null>(null);
  const [note, setNote] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  if (error) return <main className="screen no-nav"><p className="error">{error}</p></main>;
  if (!data) return <main className="screen no-nav" />;
  const { thread, entries, titles, elsewhere, labels, all, every } = data;
  if (!thread || thread.discarded_at)
    return (
      <main className="screen no-nav">
        <p className="error">This thread isn&apos;t here any more. It may be in Discarded.</p>
        <Link className="btn" href="/threads/">Back to threads</Link>
      </main>
    );
  const n = entries.length;
  const first = entries[0]?.thought;

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
    await store.updateThread(thread.id, { title: editing.title.trim().slice(0, 200), note: editing.note.trim().slice(0, 500), labels: editing.labels.slice(0, 20) });
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
          <button className="btn sm" onClick={() => setEditing({ title: thread.title, note: thread.note ?? "", labels: thread.labels ?? [] })}>
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
        {!!thread.labels?.length && (
          <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {thread.labels.map((l) => (
              <Link key={l} href={`/threads/?label=${encodeURIComponent(l)}`} className="label-chip"><span>{l}</span></Link>
            ))}
          </span>
        )}
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
          {first ? ` · started ${day(first.created_at, { weekday: false })}` : ""}
        </span>
      </div>
      <PickUpRow thoughts={every} onViewMore={() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
      <div className="row" style={{ gap: 8 }}>
        <Link href={`/write/?thread=${thread.id}`} className="btn sm ink grow" style={{ gap: 6 }}>
          <Icon name="pen" size={16} /> Write a follow-up
        </Link>
        <button className="btn sm grow" style={{ gap: 6 }} onClick={() => setLinking(true)}>
          <Icon name="plus" size={16} /> Add thoughts
        </button>
      </div>
      {note && <span className="small muted" role="status">{note}</span>}
      <ol className="timeline" ref={listRef} style={{ scrollMarginTop: 16 }}>
        {entries.map(({ thought: t, root, link }) => (
          <TimelineCard
            key={link?.id ?? t.id}
            t={t}
            root={root}
            elsewhere={t.thread_id && t.thread_id !== thread.id ? titles.get(t.thread_id) : undefined}
            onHold={() => setMenu(t)}
            onRemove={
              root
                ? undefined
                : async () => {
                    if (link) await store.unlink(link.id);
                    else await store.updateThought(t.id, { thread_id: null });
                    setNote("Taken out of this thread. The thought itself is still in Thoughts.");
                    reload();
                  }
            }
          />
        ))}
      </ol>
      {entries.length > 0 && <span className="small muted hold-hint">Press and hold a thought for more options.</span>}
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
            <span className="small" style={{ fontWeight: 600, marginTop: 4 }}>Labels <span className="muted" style={{ fontWeight: 400 }}>to group threads and filter them</span></span>
            <Topics value={editing.labels} onChange={(l) => setEditing({ ...editing, labels: l })} known={labels} word="label" example="Work" />
          </div>
        </Dialog>
      )}
      {linking && (
        <PickMany
          title="Add thoughts to this thread"
          intro="Pick thoughts you already wrote. They stay where they are and show here too, in date order."
          items={elsewhere}
          find="Find a thought"
          empty="No other thoughts to add yet."
          confirm={(k) => `Add ${k} ${k === 1 ? "thought" : "thoughts"}`}
          onClose={() => setLinking(false)}
          onDone={async (ids) => {
            for (const x of ids) {
              const t = all.find((y) => y.id === x);
              if (t) await putInThread(store, t, thread.id);
            }
            setLinking(false);
            setNote(`Added ${ids.length} ${ids.length === 1 ? "thought" : "thoughts"}.`);
            reload();
          }}
        />
      )}
      {menu && (
        <ThoughtMenu
          store={store}
          thought={menu}
          onClose={() => setMenu(null)}
          onDone={(msg) => {
            setMenu(null);
            setNote(msg);
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

/** one thought on the thread's line. Every thought looks the same, wherever else it also lives. */
function TimelineCard({ t, root, elsewhere, onHold, onRemove }: { t: Thought; root?: boolean; elsewhere?: string; onHold: () => void; onRemove?: () => void }) {
  const hold = useLongPress(onHold);
  return (
    <li>
      <span className={"tl-dot" + (root ? " root" : "")} aria-hidden="true" />
      <div className="card stack tl-card" style={{ gap: 4, borderRadius: 10, position: "relative", ...(root ? { boxShadow: "3px 3px 0 var(--lilac)" } : {}) }} {...hold}>
        <span className="row" style={{ gap: 6, alignItems: "center" }}>
          <span className="small muted grow">
            {root && <span className="tl-label" style={{ color: "var(--ink)", marginRight: 6 }}>Started here</span>}
            <strong style={{ color: "var(--ink)" }}>{day(t.created_at)}</strong> · {time(new Date(t.created_at))}
          </span>
          {onRemove && (
            <button className="icon-btn" style={{ border: 0, background: "transparent", margin: "-10px -10px -10px 0" }} aria-label="Take it out of this thread" onClick={onRemove}>
              <Icon name="close" size={14} />
            </button>
          )}
        </span>
        <Link href={`/thought/?id=${t.id}`} className="stack" style={{ gap: 4, textDecoration: "none", minHeight: 44 }}>
          <span className="serif" style={{ fontSize: 17, lineHeight: 1.35, whiteSpace: "pre-wrap" }}>{t.body}</span>
          {elsewhere && <span className="small muted">Also in “{elsewhere}”</span>}
        </Link>
      </div>
    </li>
  );
}

export default function ThreadPage() {
  return (
    <Suspense>
      <ThreadView />
    </Suspense>
  );
}
