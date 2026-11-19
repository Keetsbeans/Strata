"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { takeUndo, useData, type Undo } from "@/lib/useData";
import { day } from "@/lib/dates";
import Nav from "@/components/Nav";
import ThoughtCard, { preview } from "@/components/ThoughtCard";
import ThoughtTabs from "@/components/ThoughtTabs";
import Toast from "@/components/Toast";
import ThreadPicker from "@/components/ThreadPicker";
import Mascot from "@/components/Mascot";
import PickUpRow from "@/components/PickUpRow";
import ThoughtDeck from "@/components/ThoughtDeck";
import Icon from "@/components/Icon";
import type { Thought } from "@/lib/types";
import { putInThread } from "@/lib/threads";

function Thoughts() {
  const { store } = useApp();
  const q = useSearchParams();
  const filter = ((q.get("filter") as "unsorted" | "unfinished") || "all") as "all" | "unsorted" | "unfinished";
  const dayParam = q.get("day");
  const { data: d, error, reload } = useData(async () => {
    const [thoughts, threads] = await Promise.all([store.thoughts(), store.threads()]);
    return { thoughts, names: new Map(threads.map((t) => [t.id, t.title])) };
  }, [store]);
  const data = d?.thoughts;
  const [view, setView] = useState<"list" | "cards">(q.get("view") === "cards" ? "cards" : "list");
  const [pinning, setPinning] = useState<Thought | null>(null);
  const [note, setNote] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [toThread, setToThread] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setUndo(takeUndo()), []);
  useEffect(() => {
    setSelecting(false);
    setPicked([]);
  }, [filter, dayParam]);

  const doneUndo = useCallback(() => setUndo(null), []);

  if (error) return <main className="screen"><p className="error">{error}</p><Nav /></main>;
  if (!data) return <main className="screen"><Nav /></main>;

  const unsorted = data.filter((t) => t.finished && !t.topics.length && !t.kept);
  const unfinished = data.filter((t) => !t.finished);
  let list = filter === "unsorted" ? unsorted : filter === "unfinished" ? unfinished : data;
  if (dayParam) {
    const [y, m, d] = dayParam.split("-").map(Number);
    list = list.filter((t) => {
      const c = new Date(t.created_at);
      return c.getFullYear() === y && c.getMonth() === m - 1 && c.getDate() === d;
    });
  }

  const discard = async () => {
    const chosen = data.filter((t) => picked.includes(t.id));
    await store.discardThoughts(picked);
    setUndo({
      ids: picked,
      title: chosen.length === 1 ? "Moved to Discarded" : `${chosen.length} thoughts moved to Discarded`,
      line: `“${preview(chosen[0].body, 40)}”` + (chosen.length > 1 ? ` and ${chosen.length - 1} more` : ""),
    });
    setSelecting(false);
    setPicked([]);
    reload();
  };
  const restore = async () => {
    if (!undo) return;
    await store.restoreThoughts(undo.ids);
    setUndo(null);
    reload();
  };
  const addToThread = async (threadId: string) => {
    for (const id of picked) {
      const t = data.find((x) => x.id === id);
      if (t) await putInThread(store, t, threadId);
    }
    setToThread(false);
    setSelecting(false);
    setPicked([]);
    reload();
  };

  const threadName = (t: Thought) => (t.thread_id ? d?.names.get(t.thread_id) : undefined);
  const known = [...new Set(data.flatMap((t) => t.topics))].sort();
  const cardsOk = filter !== "unfinished";
  const showCards = view === "cards" && cardsOk && !selecting;
  const pickView = (v: "list" | "cards") => {
    setView(v);
    window.history.replaceState(null, "", v === "cards" ? `?${new URLSearchParams({ ...(filter !== "all" ? { filter } : {}), view: "cards" })}` : filter !== "all" ? `?filter=${filter}` : "/thoughts/");
  };
  const label = dayParam
    ? `${list.length} on ${day(new Date(dayParam + "T12:00"))}`
    : `${list.length} ${list.length === 1 ? "thought" : "thoughts"}${filter === "unsorted" ? " without a topic yet" : filter === "unfinished" ? " you left halfway" : ", newest first"}`;

  return (
    <>
      <main className="screen" style={selecting ? { paddingBottom: 120 } : undefined}>
        <header className="between" style={{ minHeight: 48 }}>
          <h1 className="h-big">{selecting ? `${picked.length} selected` : "Thoughts"}</h1>
          {selecting ? (
            <button className="btn" onClick={() => (setSelecting(false), setPicked([]))}>
              Cancel
            </button>
          ) : (
            <Link className="icon-btn round" href="/search/" aria-label="Search">
              <Icon name="search" size={20} />
            </Link>
          )}
        </header>
        <ThoughtTabs on={filter} unsorted={unsorted.length} unfinished={unfinished.length} />
        {dayParam && (
          <Link href="/thoughts/" className="small" style={{ fontWeight: 600 }}>
            Showing one day only. Show every day
          </Link>
        )}
        {filter === "all" && !dayParam && !selecting && !showCards && (
          <PickUpRow thoughts={data} onViewMore={() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
        )}
        {list.length > 0 && (
          <div className="between" ref={listRef} style={{ margin: "-6px 0 -8px", scrollMarginTop: 16 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              {selecting ? "Tap a thought to tick it" : showCards ? (filter === "unsorted" ? "Flip through what's unsorted" : "Flip through, newest first") : label}
            </span>
            {selecting ? (
              <button className="link" onClick={() => setPicked(picked.length === list.length ? [] : list.map((t) => t.id))}>
                {picked.length === list.length ? "Clear" : "Select all"}
              </button>
            ) : (
              <span className="row" style={{ gap: 4 }}>
                {!showCards && (
                  <button className="link small" onClick={() => setSelecting(true)}>
                    Select
                  </button>
                )}
                {cardsOk && (
                  <span className="viewswitch" role="group" aria-label="Show as">
                    <button aria-pressed={!showCards} aria-label="Show as a list" onClick={() => pickView("list")}><span><Icon name="list" size={17} /></span></button>
                    <button aria-pressed={showCards} aria-label="Show as cards to flip through" onClick={() => pickView("cards")}><span><Icon name="cards" size={17} /></span></button>
                  </span>
                )}
              </span>
            )}
          </div>
        )}
        {note && <span className="small muted" role="status">{note}</span>}
        {showCards ? (
          list.length > 0 && (
            <ThoughtDeck
              key={filter + (dayParam ?? "")}
              store={store}
              pile={list.filter((t) => t.finished)}
              known={known}
              threadName={threadName}
              emptyText="Nothing to flip through here."
              onPin={setPinning}
              onDiscard={(t) => setUndo({ ids: [t.id], title: "Moved to Discarded", line: `“${preview(t.body, 40)}”` })}
            />
          )
        ) : (
          <div className="stack">
            {list.map((t) => (
              <ThoughtCard key={t.id} t={t} selecting={selecting} picked={picked.includes(t.id)} onPick={() => setPicked((p) => (p.includes(t.id) ? p.filter((x) => x !== t.id) : [...p, t.id]))} onPin={() => setPinning(t)} threadName={threadName(t)} />
            ))}
          </div>
        )}
        {list.length === 0 && (
          <div className="empty">
            <Mascot size={72} eyes={filter === "all" ? "look" : "closed"} mouth={filter === "all" ? "o" : "smile"} />
            <h2>{filter === "unsorted" ? "All sorted" : filter === "unfinished" ? "Nothing half-written" : dayParam ? "Nothing on this day" : "No thoughts yet"}</h2>
            <p>
              {filter === "unsorted"
                ? "Every thought has a topic or has been looked at."
                : filter === "unfinished"
                  ? "Drafts you leave halfway wait here until you come back."
                  : "Whatever you write keeps its date and time, and lines up here."}
            </p>
            <Link className="btn ink" href="/new/" style={{ marginTop: 8 }}>
              Write a thought
            </Link>
          </div>
        )}
        {!selecting && !showCards && (
          <Link href="/discarded/" className="small muted" style={{ alignSelf: "center", padding: "0 12px", minHeight: 44, display: "inline-flex", alignItems: "center" }}>
            Discarded thoughts
          </Link>
        )}
      </main>
      {selecting ? (
        <div className="bar">
          <button className="btn grow" disabled={!picked.length} onClick={() => setToThread(true)}>
            Put in a thread
          </button>
          <button className="btn ink grow" disabled={!picked.length} onClick={discard}>
            Discard {picked.length || ""}
          </button>
        </div>
      ) : (
        <Nav />
      )}
      {undo && <Toast title={undo.title} line={undo.line} sub="Kept there for 30 days" onUndo={restore} onDone={doneUndo} />}
      {toThread && <ThreadPicker store={store} count={picked.length} onPick={addToThread} onClose={() => setToThread(false)} />}
      {pinning && (
        <ThreadPicker
          store={store}
          thought={pinning}
          onClose={() => setPinning(null)}
          onPick={async (tid) => {
            await putInThread(store, pinning, tid);
            const th = await store.thread(tid);
            setNote(`Put in “${th?.title ?? "the thread"}”.`);
            setPinning(null);
            reload();
          }}
        />
      )}
    </>
  );
}

export default function ThoughtsPage() {
  return (
    <Suspense>
      <Thoughts />
    </Suspense>
  );
}
