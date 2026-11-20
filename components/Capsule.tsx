"use client";
import type { TimeCapsule } from "@/lib/types";
import { MONTHS, DAYS } from "@/lib/dates";
import { progress, isReady } from "@/lib/capsule";

/** capsule dates always carry the year: "Fri 20 Nov 2026" */
export function longDay(iso: string | Date, weekday = true) {
  const d = new Date(iso);
  return `${weekday ? DAYS[d.getDay()] + " " : ""}${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * The capsule itself, drawn as a small tin. Every mark means something:
 * keyhole = spare-key seal, red wax = strict seal, lid lifted = ready, lid off = opened.
 */
export function CapsuleArt({ c, size = 64, state }: { c: Pick<TimeCapsule, "seal">; size?: number; state: "sealed" | "ready" | "opened" }) {
  const lid = state === "sealed" ? "" : state === "ready" ? "translate(2 -7) rotate(-8 40 20)" : "translate(26 -16) rotate(28 40 20)";
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true" className={"cap-art " + state}>
      <rect x="14" y="26" width="52" height="46" rx="8" fill="var(--lilac)" stroke="var(--ink)" strokeWidth="2" />
      <path d="M14 40h52" stroke="var(--ink)" strokeWidth="1.5" opacity=".35" />
      {state === "opened" && <path d="M26 30l4-10 22 2-2 10" fill="var(--card)" stroke="var(--ink)" strokeWidth="1.5" />}
      <g transform={lid} className="cap-lid">
        <rect x="10" y="14" width="60" height="14" rx="5" fill="var(--butter)" stroke="var(--ink)" strokeWidth="2" />
      </g>
      {state !== "opened" &&
        (c.seal === "strict" ? (
          <circle cx="40" cy="52" r="8" fill="#C2453A" stroke="var(--ink)" strokeWidth="1.5" />
        ) : (
          <g>
            <circle cx="40" cy="50" r="5" fill="var(--card)" stroke="var(--ink)" strokeWidth="2" />
            <path d="M40 54v7" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
          </g>
        ))}
    </svg>
  );
}

/** the wait as a line: sealed at the start, a tick halfway, you are here, a flag on the day it opens */
export function CapsuleLine({ c, compact }: { c: TimeCapsule; compact?: boolean }) {
  const p = progress(c);
  const pct = `${(p.share * 100).toFixed(1)}%`;
  const ready = isReady(c);
  return (
    <div className={"cap-line" + (compact ? " compact" : "")} role="img" aria-label={ready ? "The wait is over" : `${Math.round(p.share * 100)}% of the wait done, ${p.daysLeft} days to go`}>
      <div className="cap-track">
        <span className="cap-fill" style={{ width: pct }} />
        <span className="cap-half" style={{ left: "50%" }} title="Halfway" />
        <span className="cap-flag" aria-hidden="true">
          <svg width="18" height="22" viewBox="0 0 18 22"><path d="M3 21V2" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" /><path d="M3 2h12l-3 4 3 4H3" fill="var(--butter)" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" /></svg>
        </span>
        {!ready && (
          <span className="cap-here" style={{ left: pct }}>
            {!compact && <span className={"cap-here-tag" + (p.share < 0.18 ? " start" : p.share > 0.82 ? " end" : "")}>You are here</span>}
          </span>
        )}
      </div>
      {!compact && (
        <div className="between small muted cap-ends">
          <span>Sealed {longDay(c.created_at, false)}</span>
          <span>Halfway</span>
          <span>Opens {longDay(c.open_at, false)}</span>
        </div>
      )}
    </div>
  );
}
