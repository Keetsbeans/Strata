"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { leaveUndo, useData } from "@/lib/useData";
import { day, stamp, time } from "@/lib/dates";
import Icon from "@/components/Icon";
import Dialog from "@/components/Dialog";
import Poster from "@/components/Poster";
import PickMany from "@/components/PickMany";
import { InterestPicker, WordLinkPicker } from "@/components/Pickers";
import { cleanPick, splitLinks } from "@/lib/wordLinks";
import { rootOf } from "@/lib/threads";
import { details } from "@/lib/interests";
import { preview, topicColour } from "@/components/ThoughtCard";

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

function ThoughtView() {
  const { store } = useApp();
  const router = useRouter();
  const id = useSearchParams().get("id") || "";
  const { data, error, reload } = useData(async () => {
    const [t, all, threads, links, cols, items] = await Promise.all([store.thought(id), store.thoughts(), store.threads(), store.threadLinks(), store.collections(), store.interests()]);
    // what linked words point at, so a word whose target was deleted shows as plain text
    const targets = new Map<string, string>([...cols.map((c) => ["collection:" + c.id, c.title] as const), ...items.map((i) => ["interest:" + i.id, i.title] as const)]);
    const thread = t?.thread_id ? threads.find((x) => x.id === t.thread_id) ?? null : null;
    const inThread = thread ? all.filter((x) => x.thread_id === thread.id && x.finished).length : 0;
    const isRoot = !!thread && rootOf(thread, all)?.id === t?.id;
    const about = t?.interest_id ? await store.interest(t.interest_id) : null;
    const mine = links.filter((l) => l.thought_id === id);
    const linkedIn = mine.map((l) => threads.find((x) => x.id === l.thread_id)).filter((x): x is NonNullable<typeof x> => !!x);
    const others = threads
      .filter((x) => x.id !== t?.thread_id)
      .map((x) => {
        const root = rootOf(x, all);
        const n = all.filter((y) => y.thread_id === x.id && y.finished).length;
        return { id: x.id, title: x.title, sub: `${root ? `Starts: “${preview(root.body, 34)}” · ` : ""}${n} ${n === 1 ? "thought" : "thoughts"}`, done: mine.some((l) => l.thread_id === x.id) ? "Already linked here" : undefined };
      });
    return { t, thread, inThread, isRoot, about, linkedIn, others, targets };
  }, [store, id]);
  const [versions, setVersions] = useState<{ id: string; body: string; created_at: string }[] | null>(null);
  const [asking, setAsking] = useState(false);
  const [sheet, setSheet] = useState<null | "link" | "start">(null);
  const [pinning, setPinning] = useState(false);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");
  // press and hold a word (or select a few) to link it to a collection or something saved
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [picked, setPicked] = useState("");
  const [wordSheet, setWordSheet] = useState("");
  useEffect(() => {
    const check = () => {
      const sel = document.getSelection();
      const el = bodyRef.current;
      if (!sel || sel.isCollapsed || !el || !sel.anchorNode || !el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) return setPicked("");
      const text = cleanPick(sel.toString());
      setPicked(text.length > 0 && text.length <= 60 ? text : "");
    };
    document.addEventListener("selectionchange", check);
    return () => document.removeEventListener("selectionchange", check);
  }, []);

  if (error) return <main className="screen no-nav"><p className="error">{error}</p></main>;
  if (!data) return <main className="screen no-nav" />;
  const { t, thread, inThread, isRoot, about, linkedIn, others, targets } = data;
  if (!t || t.discarded_at)
    return (
      <main className="screen no-nav">
        <p className="error">This thought isn&apos;t here any more. It may be in Discarded.</p>
        <Link className="btn" href="/thoughts/">Back to thoughts</Link>
      </main>
    );
  const d = new Date(t.created_at);
  const live = (t.word_links ?? []).filter((w) => targets.has(`${w.kind}:${w.id}`));

  const discard = async () => {
    await store.discardThoughts([t.id]);
    leaveUndo({ ids: [t.id], title: "Moved to Discarded", line: `“${preview(t.body, 40)}”` });
    router.replace("/thoughts/");
  };

  return (
    <main className="screen no-nav">
      <header className="between">
        <button className="icon-btn round" aria-label="Back" onClick={() => router.back()}>
          <Icon name="back" />
        </button>
        <span className="h-mid" style={{ fontWeight: 600 }}>Thought</span>
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn sm" href={`/write/?id=${t.id}`}>
            Edit
          </Link>
          <button className="icon-btn" aria-label="Delete this thought" onClick={() => setAsking(true)}>
            <Icon name="trash" size={18} width={2} />
          </button>
        </div>
      </header>
      <div className="small muted">
        <strong style={{ color: "var(--ink)" }}>{day(d)}</strong> · {time(d)}
      </div>
      <div className="card" style={{ padding: "16px 18px 18px" }}>
        <p className="ruled-text" ref={bodyRef} style={{ margin: 0 }}>
          {splitLinks(t.body, live).map((p, i) =>
            p.link ? (
              <Link key={i} className="word-link" href={p.link.kind === "collection" ? `/collection/?id=${p.link.id}` : `/interest/?id=${p.link.id}`}>
                {p.text}
              </Link>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
        </p>
      </div>
      {live.length > 0 ? (
        <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span className="small muted">Linked words:</span>
          {live.map((w) => (
            <span key={w.text} className="word-chip">
              <span>{w.text} → {targets.get(`${w.kind}:${w.id}`)}</span>
              <button aria-label={`Unlink ${w.text}`} onClick={async () => (await store.updateThought(t.id, { word_links: live.filter((x) => x.text !== w.text) }), reload())}>
                <Icon name="close" size={12} width={2.6} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <span className="small muted" style={{ marginTop: -6 }}>Tip: press and hold a word to link it to a collection or something you saved.</span>
      )}
      {t.topics.length > 0 && (
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {t.topics.map((x) => (
            <span key={x} className={"tag " + topicColour(x)}>{x}</span>
          ))}
        </div>
      )}
      {t.version_count > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="small muted">
            Edited {times(t.version_count)}.{" "}
            {!versions && (
              <button className="link" style={{ minHeight: 0, fontSize: 12 }} onClick={() => store.versions(t.id).then(setVersions)}>
                See earlier versions
              </button>
            )}
          </span>
          {versions?.map((v) => (
            <div key={v.id} className="card dashed stack" style={{ gap: 4 }}>
              <span className="small muted">Before {stamp(v.created_at)}</span>
              <p className="serif" style={{ margin: 0, fontSize: 16, lineHeight: 1.35 }}>{v.body}</p>
            </div>
          ))}
        </div>
      )}
      {about && (
        <section className="stack" style={{ gap: 8 }}>
          <h2 style={{ fontSize: 15 }}>About</h2>
          <div className="item-row" style={{ paddingRight: 6 }}>
            <Poster src={about.image_url} title={about.title} kind={about.kind} className="thumb" />
            <Link className="grow" href={`/interest/?id=${about.id}`} style={{ textDecoration: "none", minHeight: 44, justifyContent: "center" }}>
              <strong>{about.title}</strong>
              <span className="sub">{details(about)}</span>
            </Link>
            <button className="icon-btn" style={{ border: 0, background: "transparent" }} aria-label={`Unpin from ${about.title}`} onClick={async () => (await store.updateThought(t.id, { interest_id: null }), reload())}>
              <Icon name="close" size={16} />
            </button>
          </div>
        </section>
      )}
      <section className="card thread-box" aria-label="Its thread">
        <h2 style={{ fontSize: 15 }}>Its thread</h2>
        {thread ? (
          <Link href={`/thread/?id=${thread.id}`} className="between" style={{ textDecoration: "none", gap: 10 }}>
            <span className="stack" style={{ gap: 2 }}>
              <span className="small muted">{isRoot ? "This thought starts the thread" : "This thought belongs to the thread"}</span>
              <strong style={{ fontWeight: 600 }}>{thread.title}</strong>
            </span>
            <span className="small muted" style={{ whiteSpace: "nowrap" }}>{inThread} {inThread === 1 ? "thought" : "thoughts"} ›</span>
          </Link>
        ) : (
          <span className="small muted">Not in a thread yet. Start one to follow this idea over time: later thoughts grow under this one.</span>
        )}
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {!thread && (
            <button className="btn sm ink" onClick={() => (setName(""), setSheet("start"))}>
              Start a thread from this
            </button>
          )}
          <button className="btn sm" onClick={() => setSheet("link")}>
            {thread ? "Also show it in another thread" : "Show it in a thread"}
          </button>
        </div>
        {linkedIn.length > 0 && (
          <p className="small muted" style={{ margin: 0 }}>
            Also linked in {linkedIn.length} {linkedIn.length === 1 ? "thread" : "threads"}:{" "}
            {linkedIn.map((x, i) => (
              <span key={x.id}>
                {i > 0 && ", "}
                <Link href={`/thread/?id=${x.id}`} style={{ color: "var(--ink)" }}>{x.title}</Link>
              </span>
            ))}
          </p>
        )}
        {thread && !isRoot && (
          <button className="link small" style={{ alignSelf: "flex-start", minHeight: 32 }} onClick={async () => (await store.updateThought(t.id, { thread_id: null }), reload())}>
            Take it out of {thread.title}
          </button>
        )}
      </section>
      {saved && <span className="small muted" role="status" style={{ textAlign: "center" }}>{saved}</span>}
      {!about && (
        <button className="btn sm block" onClick={() => setPinning(true)}>
          Pin to a film, book or song
        </button>
      )}
      {picked && !wordSheet && (
        <div className="word-bar" role="region" aria-label="Link the chosen words">
          <span className="grow small">“{preview(picked, 30)}”</span>
          <button
            className="btn sm ink"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setWordSheet(picked)}
          >
            <Icon name="link" size={15} width={2} /> Link to a collection
          </button>
        </div>
      )}
      {wordSheet && (
        <WordLinkPicker
          store={store}
          word={wordSheet}
          onClose={() => setWordSheet("")}
          onPick={async (kind, target) => {
            await store.updateThought(t.id, { word_links: [...live.filter((x) => x.text !== wordSheet), { text: wordSheet, kind, id: target }] });
            document.getSelection()?.removeAllRanges();
            setSaved(`Linked “${wordSheet}”.`);
            setWordSheet("");
            setPicked("");
            reload();
          }}
        />
      )}
      {asking && (
        <Dialog
          title="Move this thought to Discarded?"
          body={`It stays in Discarded for 30 days. You can restore it any time before then.${thread ? ` It will also leave its thread, “${thread.title}”.` : ""}`}
          face="worried"
          onClose={() => setAsking(false)}
          actions={
            <>
              <button className="btn ink block" onClick={discard}>
                Move to Discarded
              </button>
              <button className="btn block" onClick={() => setAsking(false)}>
                Keep it
              </button>
            </>
          }
        />
      )}
      {pinning && (
        <InterestPicker
          store={store}
          onClose={() => setPinning(false)}
          onPick={async (iid) => {
            await store.updateThought(t.id, { interest_id: iid });
            setPinning(false);
            reload();
          }}
        />
      )}
      {sheet === "start" && (
        <Dialog
          title="Start a thread from this"
          body="Name the idea. This thought sits at the top, and follow-ups grow under it."
          onClose={() => setSheet(null)}
          actions={
            <>
              <button
                className="btn ink block"
                disabled={!name.trim()}
                onClick={async () => {
                  const th = await store.startThread(t.id, name.trim().slice(0, 200));
                  router.push(`/thread/?id=${th.id}`);
                }}
              >
                Start the thread
              </button>
              <button className="link" style={{ fontWeight: 500 }} onClick={() => setSheet(null)}>Cancel</button>
            </>
          }
        >
          <input className="input" autoFocus aria-label="Thread name" placeholder="For example, On routine and freedom" value={name} onChange={(e) => setName(e.target.value)} />
        </Dialog>
      )}
      {sheet === "link" && (
        <PickMany
          title="Link to a thread"
          intro="It shows in that thread as a link, on its own little branch. Nothing is copied, and the thought stays where it is. Tick one or more."
          items={others}
          find="Find a thread"
          empty="No other threads yet. Start one from any thought."
          confirm={(n) => `Link to ${n} ${n === 1 ? "thread" : "threads"}`}
          onClose={() => setSheet(null)}
          onDone={async (ids) => {
            await store.linkToThreads(t.id, ids);
            setSheet(null);
            setSaved(`Linked to ${ids.length} ${ids.length === 1 ? "thread" : "threads"}.`);
            reload();
          }}
        />
      )}
    </main>
  );
}

export default function ThoughtPage() {
  return (
    <Suspense>
      <ThoughtView />
    </Suspense>
  );
}
