"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { takeUndo, useData, type Undo } from "@/lib/useData";
import { day } from "@/lib/dates";
import Nav from "@/components/Nav";
import ThoughtCard, { preview } from "@/components/ThoughtCard";
import ThoughtTabs from "@/components/ThoughtTabs";
import Toast from "@/components/Toast";
import ThreadPicker from "@/components/ThreadPicker";
import Mascot from "@/components/Mascot";
import ThoughtDeck from "@/components/ThoughtDeck";
import ThoughtMenu from "@/components/ThoughtMenu";
import Icon from "@/components/Icon";
import TopIcons from "@/components/TopIcons";
import SlideSeg from "@/components/SlideSeg";
import type { Thought } from "@/lib/types";
import { isUnsorted, putInThread } from "@/lib/threads";
import Guide from "@/components/Guide";

function Thoughts() {
  const { store } = useApp();
  const q = useSearchParams();
  const router = useRouter();
  const raw = q.get("filter");
  const dayParam = q.get("day");
  // no tab asked for: open on Unsorted when anything is waiting, otherwise on Threads
  const asked: "all" | "unsorted" | "unfinished" | null = raw === "unsorted" || raw === "unfinished" || raw === "all" ? raw : dayParam ? "all" : null;
  const { data: d, error, reload } = useData(async () => {
    const [thoughts, threads, links] = await Promise.all([store.thoughts(), store.threads(), store.threadLinks()]);
    return { thoughts, links, names: new Map(threads.map((t) => [t.id, t.title])) };
  }, [store]);
  const data = d?.thoughts;
  const unsortedCount = d ? d.thoughts.filter((t) => isUnsorted(t, d.links)).length : 0;
  const filter = asked ?? "unsorted";
  const goThreads = !!d && !asked && unsortedCount === 0;
  useEffect(() => {
    if (goThreads) router.replace("/threads/");
  }, [goThreads, router]);
  // cards suit sorting (Unsorted), a list suits looking back (All). Each remembers its own choice.
  const [views, setViews] = useState<{ unsorted: "list" | "cards"; all: "list" | "cards" }>({ unsorted: "cards", all: "list" });
  useEffect(() => {
    try {
      const u = localStorage.getItem("strata:unsorted-view");
      const a = localStorage.getItem("strata:all-view");
      setViews((v) => ({ unsorted: u === "list" ? "list" : v.unsorted, all: a === "cards" ? "cards" : v.all }));
    } catch {}
  }, []);
  const urlView = q.get("view");
  const view: "list" | "cards" = urlView === "list" || urlView === "cards" ? urlView : filter === "unsorted" ? views.unsorted : views.all;
  const [pinning, setPinning] = useState<Thought | null>(null);
  const [holding, setHolding] = useState<Thought | null>(null);
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
  if (!data || goThreads) return <main className="screen"><Nav /></main>;

  const unsorted = data.filter((t) => isUnsorted(t, d.links));
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
    const key = filter === "unsorted" ? "unsorted" : "all";
    setViews((x) => ({ ...x, [key]: v }));
    try {
      localStorage.setItem(`strata:${key}-view`, v);
    } catch {}
    router.replace(`/thoughts/?filter=${filter}`, { scroll: false });
  };
  const label = dayParam
    ? `${list.length} on ${day(new Date(dayParam + "T12:00"))}`
    : `${list.length} ${list.length === 1 ? "thought" : "thoughts"}${filter === "unsorted" ? " waiting to be sorted" : filter === "unfinished" ? " you left halfway" : ", newest first"}`;

  return (
    <>
      <main className="screen" style={selecting ? { paddingBottom: 120 } : undefined}>
        <header className="between" style={{ minHeight: 48 }}>
          <h1 className="h-page">{selecting ? `${picked.length} selected` : "Thoughts"}</h1>
          {selecting ? (
            <button className="btn sm" onClick={() => (setSelecting(false), setPicked([]))}>
              Cancel
            </button>
          ) : (
            <TopIcons />
          )}
        </header>
        <ThoughtTabs on={filter} unsorted={unsorted.length} unfinished={unfinished.length} />
        {dayParam && (
          <Link href="/thoughts/?filter=all" className="small" style={{ fontWeight: 600 }}>
            Showing one day only. Show every day
          </Link>
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
                  <SlideSeg label="Show as" dep={showCards} style={{ padding: 2 }}>
                    <button className="vs" aria-pressed={showCards} aria-label="Show as cards to flip through" onClick={() => pickView("cards")}><Icon name="cards" size={17} /></button>
                    <button className="vs" aria-pressed={!showCards} aria-label="Show as a list" onClick={() => pickView("list")}><Icon name="list" size={17} /></button>
                  </SlideSeg>
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
              <ThoughtCard key={t.id} t={t} selecting={selecting} picked={picked.includes(t.id)} onPick={() => setPicked((p) => (p.includes(t.id) ? p.filter((x) => x !== t.id) : [...p, t.id]))} onPin={() => setPinning(t)} onHold={t.finished ? () => setHolding(t) : undefined} threadName={threadName(t)} />
            ))}
          </div>
        )}
        {list.length === 0 && (
          <div className="empty">
            <Mascot size={72} eyes={filter === "all" ? "look" : "closed"} mouth={filter === "all" ? "o" : "smile"} />
            <h2>{filter === "unsorted" ? "All sorted" : filter === "unfinished" ? "Nothing half-written" : dayParam ? "Nothing on this day" : "No thoughts yet"}</h2>
            <p>
              {filter === "unsorted"
                ? "Every thought is kept, has a topic, or sits in a thread."
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
      {!selecting && (
        <Guide
          id="thoughts"
          steps={[
            { at: "tabs", title: "Where your thoughts sit", text: "Unsorted holds new thoughts you haven't done anything with yet. Keep one, give it a topic, or add it to a thread and it's sorted. Threads and All are right next to it." },
            { at: "menu", title: "That's it", text: "Threads are also in the menu, if you want a shortcut." },
          ]}
        />
      )}
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
      {holding && (
        <ThoughtMenu
          store={store}
          thought={holding}
          onClose={() => setHolding(null)}
          onDone={(msg, discarded) => {
            if (discarded) setUndo({ ids: [holding.id], title: "Moved to Discarded", line: `“${preview(holding.body, 40)}”` });
            else setNote(msg);
            setHolding(null);
            reload();
          }}
        />
      )}
      {toThread && <ThreadPicker store={store} count={picked.length} onPick={addToThread} onClose={() => setToThread(false)} />}
      {pinning && (
        <ThreadPicker
          store={store}
          thought={pinning}
          onClose={() => setPinning(null)}
          onPick={async (tid) => {
            await putInThread(store, pinning, tid);
            const th = await store.thread(tid);
            setNote(`Added to “${th?.title ?? "the thread"}”.`);
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
