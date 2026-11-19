"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import { day, relDay } from "@/lib/dates";
import Nav from "@/components/Nav";
import ThoughtTabs from "@/components/ThoughtTabs";
import { preview } from "@/components/ThoughtCard";
import Mascot from "@/components/Mascot";
import { rootOf } from "@/lib/threads";

export default function Threads() {
  const { store } = useApp();
  const router = useRouter();
  const { data, error } = useData(async () => {
    const [threads, thoughts] = await Promise.all([store.threads(), store.thoughts()]);
    return { threads, thoughts };
  }, [store]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  if (error) return <main className="screen"><p className="error">{error}</p><Nav /></main>;
  if (!data) return <main className="screen"><Nav /></main>;
  const { threads, thoughts } = data;
  const unsorted = thoughts.filter((t) => t.finished && !t.topics.length && !t.kept).length;
  const unfinished = thoughts.filter((t) => !t.finished).length;

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const t = await store.addThread(name.trim().slice(0, 200));
    router.push(`/thread/?id=${t.id}`);
  };

  return (
    <>
      <main className="screen">
        <header className="between" style={{ minHeight: 48 }}>
          <h1 className="h-big">Thoughts</h1>
          <Link className="btn" href="/review/">
            Flip through
          </Link>
        </header>
        <ThoughtTabs on="threads" unsorted={unsorted} unfinished={unfinished} />
        <span className="muted" style={{ fontSize: 13, margin: "-6px 0 -4px" }}>
          Your journal: one idea, followed over time.
        </span>
        <div className="stack">
          {threads.map((th) => {
            const inside = thoughts.filter((t) => t.thread_id === th.id && t.finished);
            const root = rootOf(th, thoughts);
            return (
              <Link key={th.id} href={`/thread/?id=${th.id}`} className="card row" style={{ textDecoration: "none", alignItems: "center", gap: 14, padding: "14px 16px" }}>
                <span className="grow stack" style={{ gap: 4, minWidth: 0 }}>
                  <strong style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.2 }}>{th.title}</strong>
                  <span className="small muted">
                    {inside.length} {inside.length === 1 ? "thought" : "thoughts"} · started {day(th.created_at, { weekday: false })}
                  </span>
                  {root && <span className="serif" style={{ fontSize: 15, lineHeight: 1.3 }}>Starts: “{preview(root.body, 70)}”</span>}
                  {inside[0] && <span className="small muted">Latest thought, {relDay(inside[0].created_at)}</span>}
                </span>
                <span className={"tag" + (th.state === "ongoing" ? " butter" : "")}>{th.state === "ongoing" ? "Ongoing" : "Resting"}</span>
              </Link>
            );
          })}
        </div>
        {threads.length === 0 && (
          <div className="empty">
            <Mascot size={72} eyes="look" mouth="o" />
            <h2>No threads yet</h2>
            <p>When an idea keeps coming back, start a thread for it and add each new thought as it arrives.</p>
          </div>
        )}
        {naming ? (
          <form className="card stack" style={{ gap: 10 }} onSubmit={start}>
            <label style={{ fontWeight: 600 }} htmlFor="tname">
              Name the idea
            </label>
            <input id="tname" className="input" autoFocus placeholder="For example, On routine and freedom" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="row">
              <button type="button" className="btn grow" onClick={() => setNaming(false)}>
                Cancel
              </button>
              <button className="btn ink grow" disabled={!name.trim()}>
                Start thread
              </button>
            </div>
          </form>
        ) : (
          <button className="btn block dashed" style={{ fontWeight: 500 }} onClick={() => setNaming(true)}>
            Start a new thread
          </button>
        )}
      </main>
      <Nav />
    </>
  );
}
