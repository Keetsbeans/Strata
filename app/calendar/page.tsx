"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import { KIND_LABEL } from "@/lib/types";
import { MONTHS_LONG, day, sameDay, time } from "@/lib/dates";
import Icon from "@/components/Icon";
import Nav from "@/components/Nav";
import Poster from "@/components/Poster";
import { preview } from "@/components/ThoughtCard";

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

/** A month at a glance: a dot for days with thoughts, a lilac dot for days you added or finished a film, book or song. */
function Calendar() {
  const { store } = useApp();
  const router = useRouter();
  const q = useSearchParams();
  const today = useMemo(() => new Date(), []);
  const start = q.get("m") ? new Date(q.get("m") + "-01T12:00") : today;
  const [month, setMonth] = useState(new Date(start.getFullYear(), start.getMonth(), 1));
  const [picked, setPicked] = useState<Date>(today);
  const { data } = useData(async () => {
    const [thoughts, interests] = await Promise.all([store.thoughts(), store.interests()]);
    return { thoughts: thoughts.filter((t) => t.finished), interests };
  }, [store]);

  const cells = useMemo(() => {
    const first = new Date(month);
    const lead = (first.getDay() + 6) % 7; // weeks start on Monday
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  }, [month]);

  const on = (d: Date) => {
    const thoughts = data?.thoughts.filter((t) => sameDay(new Date(t.created_at), d)) ?? [];
    const items = data?.interests.filter((i) => sameDay(new Date(i.done_at ?? i.created_at), d)) ?? [];
    return { thoughts, items };
  };
  const sel = on(picked);
  const move = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const summary = [sel.thoughts.length && `${sel.thoughts.length} ${sel.thoughts.length === 1 ? "thought" : "thoughts"}`, sel.items.length && `${sel.items.length} ${sel.items.length === 1 ? "interest" : "interests"}`].filter(Boolean).join(", ");

  return (
    <>
      <main className="screen">
        <header className="between">
          <button className="icon-btn round" aria-label="Back" onClick={() => router.back()}>
            <Icon name="back" />
          </button>
          <h1 className="h-mid">Calendar</h1>
          <button className="btn sm" onClick={() => (setMonth(new Date(today.getFullYear(), today.getMonth(), 1)), setPicked(today))}>
            Today
          </button>
        </header>
        <div className="between">
          <button className="icon-btn" aria-label="Previous month" onClick={() => move(-1)}>
            <Icon name="back" size={18} />
          </button>
          <strong style={{ fontSize: 18, fontWeight: 600 }}>
            {MONTHS_LONG[month.getMonth()]} {month.getFullYear()}
          </strong>
          <button className="icon-btn" aria-label="Next month" onClick={() => move(1)}>
            <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
              <Icon name="back" size={18} />
            </span>
          </button>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="cal-grid" aria-hidden="true">
            {WEEK.map((w, i) => (
              <span key={i} className="cal-head">{w}</span>
            ))}
          </div>
          <div className="cal-grid" role="grid" aria-label={`${MONTHS_LONG[month.getMonth()]} ${month.getFullYear()}`}>
            {cells.map((d, i) => {
              if (!d) return <span key={"e" + i} />;
              const { thoughts, items } = on(d);
              const isToday = sameDay(d, today);
              const isPicked = sameDay(d, picked);
              return (
                <button
                  key={d.getDate()}
                  className={"cal-day" + (isToday ? " today" : "") + (isPicked ? " picked" : "")}
                  aria-pressed={isPicked}
                  aria-label={`${day(d)}${thoughts.length ? `, ${thoughts.length} thoughts` : ""}${items.length ? `, ${items.length} interests` : ""}`}
                  onClick={() => setPicked(d)}
                >
                  <span>{d.getDate()}</span>
                  <span className="row" style={{ gap: 3, height: 6 }}>
                    {thoughts.length > 0 && <i className="cal-dot" />}
                    {items.length > 0 && <i className="cal-dot lilac" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="row small muted" style={{ gap: 14 }}>
          <span className="row" style={{ gap: 6 }}><i className="cal-dot" /> Thought</span>
          <span className="row" style={{ gap: 6 }}><i className="cal-dot lilac" /> Film, book, music or article</span>
        </div>
        <section className="stack" style={{ gap: 8 }}>
          <div className="between">
            <h2 style={{ fontSize: 17 }}>{day(picked)}</h2>
            <span className="small muted">{summary || "Nothing this day"}</span>
          </div>
          {sel.thoughts.map((t) => (
            <Link key={t.id} href={`/thought/?id=${t.id}`} className="item-row">
              <span className="link-tile" style={{ background: "var(--butter)" }} aria-hidden="true">
                <Icon name="pen" size={16} />
              </span>
              <span className="grow">
                <strong>{preview(t.body, 60)}</strong>
                <span className="sub">Thought · {time(new Date(t.created_at))}</span>
              </span>
            </Link>
          ))}
          {sel.items.map((i) => (
            <Link key={i.id} href={`/interest/?id=${i.id}`} className="item-row">
              <Poster src={i.image_url} title={i.title} kind={i.kind} className="thumb" />
              <span className="grow">
                <strong>{i.title}</strong>
                <span className="sub">
                  {KIND_LABEL[i.kind].one} · {i.done_at && sameDay(new Date(i.done_at), picked) ? `marked as ${KIND_LABEL[i.kind].done.toLowerCase()}` : "added"}
                </span>
              </span>
            </Link>
          ))}
        </section>
      </main>
      <Nav />
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Calendar />
    </Suspense>
  );
}
