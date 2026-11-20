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
import Folder from "@/components/Folder";
import TopIcons from "@/components/TopIcons";
import { comingBack } from "@/lib/inbox";
import { isReady } from "@/lib/capsule";
import { CapsuleArt, longDay } from "@/components/Capsule";
import { introSeen, markIntro } from "@/lib/intro";
import Onboarding from "@/components/Onboarding";
import { isUnsorted } from "@/lib/threads";
import Guide from "@/components/Guide";
import BoardCover from "@/components/BoardCover";

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
    const [thoughts, threads, interests, collections, links, threadLinks, capsules] = await Promise.all([store.thoughts(), store.threads(), store.interests(), store.collections(), store.links(), store.threadLinks(), store.capsules()]);
    return { thoughts, threads, interests, collections, links, threadLinks, capsules };
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

  const { thoughts, threads, interests, collections, links, threadLinks, capsules } = data;
  const readyCaps = capsules.filter((c) => !c.opened_at && isReady(c));
  const back = comingBack(thoughts, interests, now);
  const recentItems = interests.slice(0, 6);
  const byId = new Map(interests.map((i) => [i.id, i]));
  const finished = thoughts.filter((t) => t.finished);
  const drafts = thoughts.filter((t) => !t.finished).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const unsorted = finished.filter((t) => isUnsorted(t, threadLinks));
  // the one note you worked on last, finished or not
  const last = [...thoughts].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const todayCount = finished.filter((t) => sameDay(new Date(t.created_at), now)).length;
  const first = thoughts.length === 0;
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
        <Link className="new-note" href="/new/" data-tip="new" aria-label="Write a new thought">
          <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
            <span className="new-note-when">{stamp(new Date().toISOString())}</span>
            <span className="new-note-line">{first ? "Write your first thought…" : "Write a new thought…"}</span>
          </span>
          <span className="new-note-plus" aria-hidden="true"><Icon name="plus" size={20} width={2.4} /></span>
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
              <div className="card has-mascot" style={{ padding: "16px 18px" }} data-tip="pickup">
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

        <section className="stack week" style={{ gap: 8 }} aria-label="This week" data-tip="week">
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
          <section className="stack" style={{ gap: 10 }} data-tip="threads">
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

        <section className="stack" style={{ gap: 10 }} data-tip="folders">
          <h2 style={{ fontSize: 17 }}>Your folders</h2>
          {first && <span className="small muted">These fill up as you go. Nothing needs sorting today.</span>}
          <div className="folders">
            {/* colour means something: butter = waiting on you, blue = half-written, lilac = growing over time */}
            <Folder href="/thoughts/?filter=unsorted" label="Unsorted" count={unsorted.length} icon="flip" colour="var(--butter)" sheet="var(--card)" />
            <Folder href="/stack/" label="Unfinished" count={drafts.length} icon="unfinished" colour="var(--blue)" sheet="var(--card)" />
            <Folder href="/threads/" label="Threads" count={threads.length} icon="threads" colour="var(--lilac)" sheet="var(--card)" />
            <Folder href="/inbox/" label="Inbox" count={readyCaps.length + back.yearAgo.length + back.waiting.length + links.length} icon="inbox" colour="var(--butter)" sheet="var(--card)" />
          </div>
        </section>

        {readyCaps.length > 0 && (
          <Link href={`/capsule/?id=${readyCaps[0].id}`} className="card back-card cap-row ready" style={{ textDecoration: "none" }} data-tip="home-capsule">
            <span className="row" style={{ gap: 12 }}>
              <CapsuleArt c={readyCaps[0]} size={52} state="ready" />
              <span className="stack grow" style={{ gap: 2 }}>
                <strong style={{ fontWeight: 600 }}>{readyCaps.length > 1 ? `${readyCaps.length} time capsules are ready` : "A time capsule is ready"}</strong>
                <span className="small muted">“{readyCaps[0].title}”, sealed {longDay(readyCaps[0].created_at)}</span>
              </span>
              <span className="tag sm butter">Open</span>
            </span>
          </Link>
        )}

        {back.yearAgo.length > 0 && (
          <Link href="/inbox/" className="card back-card" style={{ textDecoration: "none" }}>
            <strong style={{ fontWeight: 600 }}>Coming back to you</strong>
            <p className="serif">“{preview(back.yearAgo[0].body, 110)}”</p>
            <span className="small muted">Written on this day in {new Date(back.yearAgo[0].created_at).getFullYear()}</span>
          </Link>
        )}

        {(collections.length > 0 || recentItems.length > 0) && (
          <section className="stack" style={{ gap: 10 }} data-tip="home-cols">
            <div className="between">
              <h2 style={{ fontSize: 17 }}>Collections</h2>
              <Link href="/collections/" className="link" style={{ fontSize: 13 }}>
                See all
              </Link>
            </div>
            {collections.length > 0 ? (
              <div className="pickup" style={{ gap: 12 }}>
                {collections.slice(0, 6).map((c) => (
                  <Link key={c.id} href={`/collection/?id=${c.id}`} className="board-card" style={{ flex: "0 0 132px" }}>
                    <BoardCover c={c} interests={byId} />
                    <strong style={{ fontSize: 14 }}>{c.title}</strong>
                    <span className="small muted" style={{ marginTop: -4 }}>{c.items.length} {c.items.length === 1 ? "thing" : "things"}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <Link href="/collections/" className="card small" style={{ borderStyle: "dashed", background: "transparent" }}>
                You&apos;ve saved {interests.length} {interests.length === 1 ? "thing" : "things"}. Group them into a collection, like “For a rainy Sunday”.
              </Link>
            )}
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
      <Guide
        id="home"
        wait={900}
        steps={[
          { at: "new", title: "Write a thought", text: "Tap this note to write whatever's on your mind. Type it or say it out loud. Every thought keeps its date and time." },
          { at: "pickup", title: "Pick up where you left off", text: "The last thought you worked on waits here, so you can carry on or finish a draft." },
          { at: "week", title: "Your week", text: "A dot marks each day you wrote. Tap a day to see what you wrote then, swipe for earlier weeks, or tap the month for the full calendar." },
          threads.length
            ? { at: "threads", title: "Your threads", text: "A thread follows one idea over time. When the idea comes back, add the new thought to its thread." }
            : { at: "folders", title: "Threads", text: "When an idea keeps coming back, start a thread from any thought and add follow-ups as they come." },
          { at: "folders", title: "Your folders", text: "Unsorted holds new thoughts you haven't dealt with. Unfinished holds drafts. Threads and Inbox are one tap away." },
          { at: "home-cols", title: "Collections", text: "Films, books, songs and links you love, grouped into boards you can arrange and decorate." },
          { at: "nav", title: "Getting around", text: "Home, all your Thoughts, the + for a new thought, and Collections. These stay at the bottom of every page." },
          { at: "menu", title: "The menu", text: "Threads, your calendar, imports, discarded thoughts and settings all live in here." },
        ]}
      />
      <Nav />
    </>
  );
}
