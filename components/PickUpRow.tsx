"use client";
import Link from "next/link";
import { useMemo } from "react";
import type { Thought } from "@/lib/types";
import { relDay } from "@/lib/dates";
import { preview } from "./ThoughtCard";

const RECENT_DAYS = 14;

/** same "random" picks all day, so the row doesn't reshuffle on every visit */
function dailyShuffle<T extends { id: string }>(list: T[]) {
  const seed = new Date().toDateString();
  const score = (id: string) => {
    let h = 0;
    for (const c of seed + id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h;
  };
  return [...list].sort((a, b) => score(a.id) - score(b.id));
}

/**
 * Up to 3 cards to get back to: the thoughts you worked on most recently.
 * If nothing was touched lately, 3 picks from further back instead.
 * Swipe to the end for "View more", which scrolls down to the full list.
 */
export default function PickUpRow({ thoughts, onViewMore, min = 4 }: { thoughts: Thought[]; onViewMore: () => void; min?: number }) {
  const { picks, recent } = useMemo(() => {
    const since = Date.now() - RECENT_DAYS * 86400000;
    const byWork = [...thoughts].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const lately = byWork.filter((t) => new Date(t.updated_at).getTime() > since).slice(0, 3);
    return lately.length ? { picks: lately, recent: true } : { picks: dailyShuffle(thoughts.filter((t) => t.finished)).slice(0, 3), recent: false };
  }, [thoughts]);

  if (thoughts.length < min || !picks.length) return null;
  return (
    <section className="stack" style={{ gap: 8 }} aria-label={recent ? "Pick up again" : "From further back"}>
      <div className="between">
        <h2 style={{ fontSize: 15 }}>{recent ? "Pick up again" : "From further back"}</h2>
        <span className="small muted">Swipe</span>
      </div>
      <div className="pickup">
        {picks.map((t) => (
          <Link key={t.id} href={t.finished ? `/thought/?id=${t.id}` : `/write/?id=${t.id}`} className="card pickup-card">
            <span className="small muted">{t.finished ? `Worked on ${relDay(t.updated_at)}` : "Unfinished"}</span>
            <span className="serif" style={{ fontSize: 17, lineHeight: 1.3 }}>{preview(t.body, 90)}</span>
          </Link>
        ))}
        <button type="button" className="card pickup-card pickup-more" onClick={onViewMore}>
          <strong style={{ fontWeight: 600, fontSize: 16 }}>View more</strong>
          <span className="small muted">All {thoughts.length} below</span>
        </button>
      </div>
    </section>
  );
}
