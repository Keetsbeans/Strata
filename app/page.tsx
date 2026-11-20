"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "./providers";
import { useData } from "@/lib/useData";
import { DAYS, MONTHS_LONG, sameDay, stamp, relDay } from "@/lib/dates";
import Nav from "@/components/Nav";
import Mascot from "@/components/Mascot";
import Icon from "@/components/Icon";
import Logo from "@/components/Logo";
import { preview } from "@/components/ThoughtCard";
import Poster from "@/components/Poster";
import Folder from "@/components/Folder";
import TopIcons from "@/components/TopIcons";
import { comingBack } from "@/lib/inbox";
import { introSeen, markIntro } from "@/lib/intro";
import Onboarding from "@/components/Onboarding";

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
  // people who set up before the opening screens existed, or who asked to see them again
  const [intro, setIntro] = useState(false);
  useEffect(() => setIntro(!introSeen()), []);
  const now = useMemo(() => new Date(), []);
  const [hello, when] = greeting(now);

  // one week at a time, Monday to Sunday; arrows (or a swipe) go back a week
  const [week, setWeek] = useState(0);
  const swipe = useRef<number | null>(null);
  const days = useMemo(() => {
    const monday = new Date(now);
    monday.setHours(12, 0, 0, 0);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + week * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [now, week]);

  if (intro) return <Onboarding onDone={() => (markIntro(true), setIntro(false))} />;
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
  const pinCount = (id: string) => finished.filter((t) => t.interest_id === id).length;
  const latestOf = (id: string) => finished.filter((t) => t.thread_id === id)[0];

  return (
    <>
      <header className="dark home-head">
        <div className="between">
          <Logo dark />
          <TopIcons dark />
        </div>
        <span style={{ display: "block", fontSize: 15, color: "var(--on-dark)", marginTop: 14 }}>{first ? "Welcome" : hello}</span>
        <h1 style={{ fontSize: 30, lineHeight: 1.08, letterSpacing: "-0.02em", margin: "4px 0 18px" }}>
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
        <Link className="btn lilac block new-big" href="/new/">
          <Icon name="plus" size={20} /> New thought
        </Link>
      </header>

      <main className="screen" style={{ paddingTop: 22, minHeight: 0 }}>
        {first ? (
          <div className="card has-mascot first-card" style={{ padding: "18px 18px 16px" }}>
            <Mascot size={70} className="card-mascot" arms="wave" eyes="happy" mouth="smile" />
            <span className="speech">Hi! I keep your thoughts safe.</span>
            <p className="serif" style={{ fontSize: 22, lineHeight: 1.3, margin: "10px 0 6px" }}>
              What is one thing on your mind right now?
            </p>
            <p className="small muted" style={{ margin: "0 0 14px" }}>Type it, or tap the microphone and say it out loud.</p>
            <Link className="btn ink block shadow" href="/write/">
              Write your first thought
            </Link>
          </div>
        ) : (
          <>
            {last && !hideLast && (
              <div className="card has-mascot" style={{ padding: "16px 18px" }}>
                <Mascot size={62} className="card-mascot" arms="wave" eyes={last.finished ? "happy" : "look"} mouth={last.finished ? "smile" : "o"} />
                <div className="between">
                  <strong style={{ fontWeight: 600 }}>{last.finished ? "Pick up where you left off" : "You left this unfinished"}</strong>
                  <span className="small muted">{stamp(last.updated_at)}</span>
                </div>
                <p className="serif" style={{ fontSize: 18, lineHeight: 1.35, margin: "8px 0 14px" }}>
                  {preview(last.body, 120)}
                </p>
                <div className="row">
                  <Link className="btn ink grow shadow" href={`/write/?id=${last.id}`}>
                    Keep writing
                  </Link>
                  <button className="btn" onClick={() => setHideLast(true)}>
                    Not now
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <section className="stack week" style={{ gap: 8 }} aria-label="This week">
          <div className="between">
            <Link href="/calendar/" className="month-link">
              <Icon name="calendar" size={16} /> {MONTHS_LONG[days[3].getMonth()]} {days[3].getFullYear()}
            </Link>
            <span className="row" style={{ gap: 2 }}>
              <button className="icon-btn plain" aria-label="Previous week" onClick={() => setWeek(week - 1)}>
                <Icon name="back" size={18} />
              </button>
              <button className="icon-btn plain" aria-label="Next week" disabled={week >= 0} style={{ opacity: week >= 0 ? 0.3 : 1 }} onClick={() => setWeek(Math.min(0, week + 1))}>
                <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}><Icon name="back" size={18} /></span>
              </button>
            </span>
          </div>
          <div
            className="week-row"
            key={week}
            onPointerDown={(e) => (swipe.current = e.clientX)}
            onPointerUp={(e) => {
              if (swipe.current === null) return;
              const dx = e.clientX - swipe.current;
              swipe.current = null;
              if (dx > 50) setWeek(week - 1);
              else if (dx < -50 && week < 0) setWeek(week + 1);
            }}
          >
            {days.map((d) => {
              const has = finished.some((t) => sameDay(new Date(t.created_at), d));
              const today = sameDay(d, now);
              const future = d > now && !today;
              const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              const inner = (
                <>
                  <span style={{ fontSize: 11, fontWeight: 500 }}>{DAYS[d.getDay()]}</span>
                  <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.1 }}>{d.getDate()}</span>
                  <span className="strip-dot" style={{ visibility: has ? "visible" : "hidden" }} />
                </>
              );
              return future ? (
                <span key={iso} className="strip-day future" aria-hidden="true">{inner}</span>
              ) : (
                <Link key={iso} href={`/calendar/?d=${iso}`} className={"strip-day" + (today ? " today" : "")} aria-label={`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}${has ? ", has thoughts" : ""}`}>
                  {inner}
                </Link>
              );
            })}
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {week === 0 ? `This week · ${todayCount} ${todayCount === 1 ? "thought" : "thoughts"} today` : week === -1 ? "Last week" : `${-week} weeks ago`} · dots mark days you wrote
          </p>
        </section>

        {threads.length > 0 && (
          <section className="stack" style={{ gap: 10 }}>
            <div className="between">
              <h2 style={{ fontSize: 17 }}>Your threads</h2>
              <Link href="/threads/" className="link" style={{ fontSize: 13 }}>
                See all {threads.length}
              </Link>
            </div>
            {threads.slice(0, 3).map((th) => {
              const last = latestOf(th.id);
              const n = finished.filter((t) => t.thread_id === th.id).length;
              return (
                <Link key={th.id} href={`/thread/?id=${th.id}`} className="card thread-home">
                  <span className="thread-spine" aria-hidden="true"><i /><i /><i /></span>
                  <span className="stack grow" style={{ gap: 3, minWidth: 0 }}>
                    <strong style={{ fontSize: 16, fontWeight: 600 }}>{th.title}</strong>
                    {last && <span className="serif clamp2" style={{ fontSize: 15, lineHeight: 1.3 }}>“{preview(last.body, 90)}”</span>}
                    <span className="small muted">
                      {n} {n === 1 ? "thought" : "thoughts"}
                      {last ? " · latest " + relDay(last.created_at) : ""}
                    </span>
                  </span>
                </Link>
              );
            })}
          </section>
        )}

        <section className="stack" style={{ gap: 10 }}>
          <h2 style={{ fontSize: 17 }}>Your folders</h2>
          {first && <span className="small muted">These fill up as you go. Nothing needs sorting today.</span>}
          <div className="folders">
            <Folder href="/thoughts/?filter=unsorted&view=cards" label="Unsorted" count={unsorted.length} icon="flip" colour="var(--butter)" sheet="var(--blue)" />
            <Folder href="/stack/" label="Unfinished" count={drafts.length} icon="unfinished" colour="var(--blue)" sheet="var(--lilac)" />
            <Folder href="/interests/" label="Saved" count={interests.length} icon="interests" colour="var(--lilac)" sheet="var(--butter)" />
            <Folder href="/collections/" label="Collections" count={collections.length} icon="collections" colour="var(--butter)" sheet="var(--lilac)" />
            <Folder href="/threads/" label="Threads" count={threads.length} icon="threads" colour="var(--card)" sheet="var(--lilac)" />
            <Folder href="/inbox/" label="Inbox" count={back.yearAgo.length + back.waiting.length + links.length} icon="inbox" colour="var(--card)" sheet="var(--butter)" />
          </div>
        </section>

        {back.yearAgo.length > 0 && (
          <Link href="/inbox/" className="card back-card" style={{ textDecoration: "none" }}>
            <strong style={{ fontWeight: 600 }}>Coming back to you</strong>
            <p className="serif">“{preview(back.yearAgo[0].body, 110)}”</p>
            <span className="small muted">Written on this day in {new Date(back.yearAgo[0].created_at).getFullYear()}</span>
          </Link>
        )}

        {recentItems.length > 0 && (
          <section className="stack" style={{ gap: 10 }}>
            <div className="between">
              <h2 style={{ fontSize: 17 }}>Recently saved films, books and music</h2>
              <Link href="/interests/" className="link" style={{ fontSize: 13 }}>
                See all
              </Link>
            </div>
            <p className="small muted" style={{ margin: "-4px 0 0" }}>The last things you added to Saved. Tap one to see your thoughts on it.</p>
            <div className="pickup" style={{ gap: 12 }}>
              {recentItems.map((i) => (
                <Link key={i.id} href={`/interest/?id=${i.id}`} className="shelf-item" style={{ flex: "0 0 104px" }}>
                  <Poster src={i.image_url} title={i.title} kind={i.kind} />
                  <span className="small" style={{ fontWeight: 600, lineHeight: 1.2 }}>{i.title}</span>
                  <span className="small muted">{pinCount(i.id) ? `${pinCount(i.id)} ${pinCount(i.id) === 1 ? "thought" : "thoughts"}` : "No thoughts yet"}</span>
                </Link>
              ))}
            </div>
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
