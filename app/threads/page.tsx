"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import { day, relDay } from "@/lib/dates";
import Nav from "@/components/Nav";
import TopIcons from "@/components/TopIcons";
import ThoughtTabs from "@/components/ThoughtTabs";
import Dialog from "@/components/Dialog";
import { preview } from "@/components/ThoughtCard";
import Mascot from "@/components/Mascot";
import Icon from "@/components/Icon";
import { isUnsorted, rootOf } from "@/lib/threads";

type Sort = "recent" | "oldest" | "most";
const SORTS: Record<Sort, string> = { recent: "Latest thought first", oldest: "Oldest thread first", most: "Most thoughts first" };

function Threads() {
  const { store } = useApp();
  const router = useRouter();
  const q = useSearchParams();
  const { data, error } = useData(async () => {
    const [threads, thoughts, links] = await Promise.all([store.threads(), store.thoughts(), store.threadLinks()]);
    return { threads, thoughts, links };
  }, [store]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  // filters: one state (ongoing or resting) and any number of labels
  const [state, setState] = useState<"" | "ongoing" | "resting">("");
  const [labels, setLabels] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("recent");
  // a short explainer the first few times, until it's put away
  const [intro, setIntro] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem("strata:threads-intro")) setIntro(true);
    } catch {}
  }, []);
  const hideIntro = () => {
    setIntro(false);
    try {
      localStorage.setItem("strata:threads-intro", "1");
    } catch {}
  };
  useEffect(() => {
    const l = q.get("label");
    if (l) setLabels([l]);
    try {
      const s = localStorage.getItem("strata:threads-sort") as Sort | null;
      if (s && s in SORTS) setSort(s);
    } catch {}
  }, [q]);

  if (error) return <main className="screen"><p className="error">{error}</p><Nav /></main>;
  if (!data) return <main className="screen"><Nav /></main>;
  const { threads, thoughts, links } = data;

  const start = async () => {
    if (!name.trim()) return;
    const t = await store.addThread(name.trim().slice(0, 200));
    router.push(`/thread/?id=${t.id}`);
  };
  const pickSort = (s: Sort) => {
    setSort(s);
    try {
      localStorage.setItem("strata:threads-sort", s);
    } catch {}
  };

  const allLabels = [...new Set(threads.flatMap((t) => t.labels ?? []))].sort();
  const info = new Map(
    threads.map((th) => {
      const inside = thoughts.filter((t) => t.thread_id === th.id && t.finished);
      const linked = links.filter((l) => l.thread_id === th.id).length;
      const latest = inside.reduce((m, t) => (t.created_at > m ? t.created_at : m), th.created_at);
      return [th.id, { inside, linked, latest, root: rootOf(th, thoughts) }];
    }),
  );
  const shown = threads
    .filter((th) => (!state || th.state === state) && labels.every((l) => th.labels?.includes(l)))
    .sort((a, b) => {
      const A = info.get(a.id)!;
      const B = info.get(b.id)!;
      if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
      if (sort === "most") return B.inside.length + B.linked - (A.inside.length + A.linked) || B.latest.localeCompare(A.latest);
      return B.latest.localeCompare(A.latest);
    });
  const filtering = !!state || labels.length > 0;
  const toggleLabel = (l: string) => setLabels((x) => (x.includes(l) ? x.filter((y) => y !== l) : [...x, l]));

  return (
    <>
      <main className="screen">
        <header className="between" style={{ minHeight: 48 }}>
          <h1 className="h-page">Thoughts</h1>
          <TopIcons />
        </header>
        <ThoughtTabs on="threads" unsorted={thoughts.filter((t) => isUnsorted(t, links)).length} unfinished={thoughts.filter((t) => !t.finished).length} />
        {intro ? (
          <div className="card threads-intro">
            <Mascot size={52} eyes="happy" arms="wave" />
            <span className="stack grow" style={{ gap: 4 }}>
              <strong>What&apos;s a thread?</strong>
              <span className="small">One idea, followed over time. Start one from any thought, then add follow-ups as they come. A thought can be in more than one thread.</span>
              <span className="small muted">Tip: press and hold any thought to add it to a thread.</span>
              <button className="link small" style={{ alignSelf: "flex-start", minHeight: 44, minWidth: 44, fontWeight: 600 }} onClick={hideIntro}>Got it</button>
            </span>
          </div>
        ) : (
          <span className="muted" style={{ fontSize: 13, marginTop: -10 }}>
            One idea, followed over time.
          </span>
        )}
        {threads.length > 0 && (
          <div className="stack" style={{ gap: 2 }}>
            <div className="pills" role="group" aria-label="Show">
              <button className="pill" aria-pressed={!filtering} onClick={() => (setState(""), setLabels([]))}>
                <span>All · {threads.length}</span>
              </button>
              {(["ongoing", "resting"] as const).map((s) => (
                <button key={s} className="pill" aria-pressed={state === s} onClick={() => setState(state === s ? "" : s)}>
                  <span>{s === "ongoing" ? "Ongoing" : "Resting"}</span>
                </button>
              ))}
              {allLabels.length > 0 && <span className="pill-gap" aria-hidden="true" />}
              {allLabels.map((l) => (
                <button key={l} className="pill label" aria-pressed={labels.includes(l)} onClick={() => toggleLabel(l)}>
                  <span>{l}</span>
                </button>
              ))}
            </div>
            <div className="between">
              <span className="row" style={{ gap: 4 }}>
              <span className="muted" style={{ fontSize: 13 }}>
                {filtering ? `${shown.length} of ${threads.length}` : `${threads.length} ${threads.length === 1 ? "thread" : "threads"}`} ·
              </span>
              <label className="sort-pick">
                <span className="sr-only">Sort threads</span>
                <select value={sort} onChange={(e) => pickSort(e.target.value as Sort)}>
                  {(Object.keys(SORTS) as Sort[]).map((s) => (
                    <option key={s} value={s}>{SORTS[s]}</option>
                  ))}
                </select>
                <span className="caret" aria-hidden="true" />
              </label>
              </span>
              <button className="new-pill" onClick={() => setNaming(true)} aria-label="Start a new thread">
                <span><Icon name="plus" size={15} width={2.4} /> New thread</span>
              </button>
            </div>
          </div>
        )}
        <div className="stack">
          {shown.map((th) => {
            const { inside, linked, latest, root } = info.get(th.id)!;
            return (
              <Link key={th.id} href={`/thread/?id=${th.id}`} className="card thread-home">
                <span className="thread-spine" aria-hidden="true"><i /><i /><i /></span>
                <span className="grow stack" style={{ gap: 4, minWidth: 0 }}>
                  <span className="between" style={{ alignItems: "flex-start", gap: 8 }}>
                    <strong style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.2 }}>{th.title}</strong>
                    <span className={"tag sm" + (th.state === "ongoing" ? " butter" : "")}>{th.state === "ongoing" ? "Ongoing" : "Resting"}</span>
                  </span>
                  {root && <span className="serif" style={{ fontSize: 15, lineHeight: 1.3 }}>“{preview(root.body, 80)}”</span>}
                  <span className="small muted">
                    {inside.length + linked} {inside.length + linked === 1 ? "thought" : "thoughts"} · {inside.length ? `latest ${relDay(latest)}` : `started ${day(th.created_at, { weekday: false })}`}
                  </span>
                  {!!th.labels?.length && (
                    <span className="row" style={{ gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                      {th.labels.map((l) => (
                        <span key={l} className="label-mini">{l}</span>
                      ))}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
        {threads.length > 0 && shown.length === 0 && (
          <div className="empty" style={{ padding: "20px 0" }}>
            <p>No threads match. <button className="link" onClick={() => (setState(""), setLabels([]))}>Show them all</button></p>
          </div>
        )}
        {threads.length === 0 && (
          <div className="empty">
            <Mascot size={72} eyes="look" mouth="o" />
            <h2>No threads yet</h2>
            <p>When an idea keeps coming back, start a thread for it and add each new thought as it arrives. You can also start one from any thought.</p>
            <button className="btn ink" onClick={() => setNaming(true)} style={{ marginTop: 8 }}>
              Start a thread
            </button>
          </div>
        )}
      </main>
      <Nav />
      {naming && (
        <Dialog
          title="Start a new thread"
          face="thinking"
          onClose={() => setNaming(false)}
          actions={
            <>
              <button className="btn ink block" disabled={!name.trim()} onClick={start}>
                Start thread
              </button>
              <button className="link" style={{ fontWeight: 500 }} onClick={() => setNaming(false)}>
                Cancel
              </button>
            </>
          }
        >
          <form
            className="stack"
            style={{ gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
          >
            <label className="small" style={{ fontWeight: 600 }} htmlFor="tname">
              Name the idea
            </label>
            <input id="tname" className="input" placeholder="For example, On routine and freedom" value={name} onChange={(e) => setName(e.target.value)} />
          </form>
        </Dialog>
      )}
    </>
  );
}

export default function ThreadsPage() {
  return (
    <Suspense>
      <Threads />
    </Suspense>
  );
}
