"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "./providers";
import { useData } from "@/lib/useData";
import { DAYS, MONTHS_LONG, sameDay, stamp, day, relDay } from "@/lib/dates";
import Nav from "@/components/Nav";
import Mascot from "@/components/Mascot";
import Icon from "@/components/Icon";
import { preview } from "@/components/ThoughtCard";
import Poster from "@/components/Poster";
import { comingBack } from "@/lib/inbox";

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 5) return ["Late night", "tonight"];
  if (h < 12) return ["Morning", "this morning"];
  if (h < 17) return ["Afternoon", "this afternoon"];
  return ["Evening", "tonight"];
}

export default function Home() {
  const { store } = useApp();
  const { data, error } = useData(async () => {
    const [thoughts, threads, interests, collections, links] = await Promise.all([store.thoughts(), store.threads(), store.interests(), store.collections(), store.links()]);
    return { thoughts, threads, interests, collections, links };
  }, [store]);
  const [hideLast, setHideLast] = useState(false);
  const now = useMemo(() => new Date(), []);
  const [hello, when] = greeting(now);

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      out.push(d);
    }
    return out;
  }, [now]);

  if (error) return <main className="screen"><p className="error">{error}</p><Nav /></main>;
  if (!data) return <main className="screen"><Nav /></main>;

  const { thoughts, threads, interests, collections, links } = data;
  const back = comingBack(thoughts, interests, now);
  const recentItems = interests.slice(0, 6);
  const finished = thoughts.filter((t) => t.finished);
  const drafts = thoughts.filter((t) => !t.finished).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const unsorted = finished.filter((t) => !t.topics.length && !t.kept);
  // the one note you worked on last, finished or not
  const last = [...thoughts].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const todayCount = finished.filter((t) => sameDay(new Date(t.created_at), now)).length;
  const first = thoughts.length === 0;
  const latestOf = (id: string) => finished.filter((t) => t.thread_id === id)[0];

  return (
    <>
      <header className="dark home-head">
        <div className="between">
          <span style={{ fontSize: 15, color: "var(--on-dark)" }}>{first ? "Welcome" : hello}</span>
          <Link href="/settings/" className="avatar" aria-label="Settings">
            <Icon name="pen" size={16} />
          </Link>
        </div>
        <h1 style={{ fontSize: 30, lineHeight: 1.08, letterSpacing: "-0.02em", margin: "10px 0 18px" }}>
          {first ? (
            <>
              Nothing here yet.
              <br />
              Shall we start?
            </>
          ) : (
            <>
              What&apos;s on your
              <br />
              mind {when}?
            </>
          )}
        </h1>
        <div className="between" style={{ marginBottom: 10 }}>
          <span style={{ fontWeight: 600 }}>
            {MONTHS_LONG[now.getMonth()]} {now.getFullYear()}
          </span>
          <span className="small" style={{ color: "var(--on-dark)" }}>
            Today, {day(now)} · {todayCount} {todayCount === 1 ? "thought" : "thoughts"} so far
          </span>
        </div>
        <div className="strip" ref={(el) => {
            if (el) el.scrollLeft = el.scrollWidth;
          }}>
          {days.map((d) => {
            const has = finished.some((t) => sameDay(new Date(t.created_at), d));
            const today = sameDay(d, now);
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            return (
              <Link key={iso} href={`/thoughts/?day=${iso}`} className={"strip-day" + (today ? " today" : "")} aria-label={`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}${has ? ", has thoughts" : ""}`}>
                <span style={{ fontSize: 11, fontWeight: 500 }}>{DAYS[d.getDay()]}</span>
                <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.1 }}>{d.getDate()}</span>
                <span className="strip-dot" style={{ visibility: has ? "visible" : "hidden" }} />
              </Link>
            );
          })}
        </div>
      </header>

      <main className="screen" style={{ paddingTop: 22, minHeight: 0 }}>
        {first ? (
          <div className="card" style={{ padding: "18px 18px 16px", boxShadow: "3px 3px 0 var(--lilac)" }}>
            <span className="small muted">Your first card</span>
            <p className="serif" style={{ fontSize: 22, lineHeight: 1.3, margin: "6px 0 14px" }}>
              What is one thing on your mind right now?
            </p>
            <Link className="btn ink block" href="/new/">
              Write your first thought
            </Link>
          </div>
        ) : (
          <>
            {last && !hideLast && (
              <div className="card" style={{ padding: "16px 18px", boxShadow: "3px 3px 0 var(--lilac)" }}>
                <div className="between">
                  <strong style={{ fontWeight: 600 }}>{last.finished ? "Pick up where you left off" : "You left this unfinished"}</strong>
                  <span className="small muted">{stamp(last.updated_at)}</span>
                </div>
                <p className="serif" style={{ fontSize: 18, lineHeight: 1.35, margin: "8px 0 14px" }}>
                  {preview(last.body, 120)}
                </p>
                <div className="row">
                  <Link className="btn ink grow" href={`/write/?id=${last.id}`}>
                    Keep writing
                  </Link>
                  <button className="btn" onClick={() => setHideLast(true)}>
                    Not now
                  </button>
                </div>
              </div>
            )}
            <Link className="btn ink block shadow" href="/new/">
              <Icon name="plus" size={18} /> New thought
            </Link>
          </>
        )}

        <section className="stack" style={{ gap: 10 }}>
          <h2 style={{ fontSize: 17 }}>Your folders</h2>
          {first && <span className="small muted">These fill up as you go. Nothing needs sorting today.</span>}
          <div className="folders">
            <Link href="/review/" className="folder">
              <span>To flip through</span>
              <b>{unsorted.length}</b>
            </Link>
            <Link href="/thoughts/?filter=unfinished" className="folder">
              <span>Unfinished</span>
              <b>{drafts.length}</b>
            </Link>
            <Link href="/threads/" className="folder">
              <span>Threads</span>
              <b>{threads.length}</b>
            </Link>
            <Link href="/interests/" className="folder">
              <span>Interests</span>
              <b>{interests.length}</b>
            </Link>
            <Link href="/collections/" className="folder">
              <span>Collections</span>
              <b>{collections.length}</b>
            </Link>
            <Link href="/inbox/" className="folder">
              <span>Inbox</span>
              <b>{back.yearAgo.length + back.waiting.length + links.length}</b>
            </Link>
          </div>
        </section>

        {back.yearAgo.length > 0 && (
          <Link href="/inbox/" className="card back-card" style={{ textDecoration: "none", boxShadow: "3px 3px 0 var(--butter)" }}>
            <strong style={{ fontWeight: 600 }}>Coming back to you</strong>
            <p className="serif">“{preview(back.yearAgo[0].body, 110)}”</p>
            <span className="small muted">Written on this day in {new Date(back.yearAgo[0].created_at).getFullYear()}</span>
          </Link>
        )}

        {recentItems.length > 0 && (
          <section className="stack" style={{ gap: 10 }}>
            <div className="between">
              <h2 style={{ fontSize: 17 }}>Recent interests</h2>
              <Link href="/interests/" className="link" style={{ fontSize: 13 }}>
                See all
              </Link>
            </div>
            <div className="pickup" style={{ gap: 12 }}>
              {recentItems.map((i) => (
                <Link key={i.id} href={`/interest/?id=${i.id}`} className="shelf-item" style={{ flex: "0 0 104px" }}>
                  <Poster src={i.image_url} title={i.title} kind={i.kind} />
                  <span className="small" style={{ fontWeight: 600, lineHeight: 1.2 }}>{i.title}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {threads.length > 0 && (
          <section className="stack" style={{ gap: 10 }}>
            <div className="between">
              <h2 style={{ fontSize: 17 }}>Threads you are following</h2>
              <Link href="/threads/" className="link" style={{ fontSize: 13 }}>
                See all
              </Link>
            </div>
            {threads.slice(0, 3).map((th) => {
              const last = latestOf(th.id);
              const n = finished.filter((t) => t.thread_id === th.id).length;
              return (
                <Link key={th.id} href={`/thread/?id=${th.id}`} className="card stack" style={{ gap: 2, textDecoration: "none" }}>
                  <strong style={{ fontSize: 16, fontWeight: 600 }}>{th.title}</strong>
                  <span className="small muted">
                    {n} {n === 1 ? "thought" : "thoughts"}
                    {last ? " · last added " + relDay(last.created_at) : ""}
                  </span>
                </Link>
              );
            })}
          </section>
        )}

        {first && (
          <section className="card stack" style={{ gap: 6, background: "transparent", borderStyle: "dashed" }}>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <Mascot size={56} />
              <div className="stack" style={{ gap: 4 }}>
                <strong style={{ fontWeight: 600 }}>How this works</strong>
                <span style={{ fontSize: 14 }}>
                  Everything you save keeps its date and time. Over weeks it falls into one line you can scroll back through.
                </span>
                <span className="small muted">Private by default. Nothing reads or interprets what you write.</span>
              </div>
            </div>
          </section>
        )}
      </main>
      <Nav />
    </>
  );
}
