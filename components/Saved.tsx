"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Interest, InterestKind, InterestStatus } from "@/lib/types";
import { KIND_LABEL } from "@/lib/types";
import { moodColour } from "@/lib/moods";
import Poster from "./Poster";
import Icon from "./Icon";

export type Filters = { kind: InterestKind | null; mood: string | null; genre: string | null; status: InterestStatus | null };
export const NO_FILTERS: Filters = { kind: null, mood: null, genre: null, status: null };

const has = (list: string[] | undefined, x: string | null) => !x || (list ?? []).some((m) => m.toLowerCase() === x.toLowerCase());
export const matches = (i: Interest, f: Filters) => (!f.kind || i.kind === f.kind) && has(i.moods, f.mood) && has(i.genres, f.genre) && (!f.status || i.status === f.status);

/** "Album", "Book", "Link" and so on */
export const kindWord = (k: InterestKind) => (k === "music" ? "Music" : k === "article" ? "Link" : KIND_LABEL[k].one);

/** a row of slim drop-down pills: Type, Mood, Genre and Want to / Done. Type only shows when the things are of more than one kind. */
export function FilterBar({ items, value, onChange, moods, onEditMoods }: { items: Interest[]; value: Filters; onChange: (f: Filters) => void; moods: string[]; onEditMoods?: () => void }) {
  const [open, setOpen] = useState<null | keyof Filters>(null);
  const kinds = (["film", "book", "music", "article"] as InterestKind[]).filter((k) => items.some((i) => i.kind === k));
  const genres = [...new Set(items.filter((i) => !value.kind || i.kind === value.kind).flatMap((i) => i.genres ?? []))].sort();
  const allMoods = [...new Set([...moods, ...items.flatMap((i) => i.moods)].map((m) => m[0].toUpperCase() + m.slice(1)))];
  const options: Record<keyof Filters, { label: string; list: { v: string; label: string; dot?: string }[] }> = {
    kind: { label: "Type", list: kinds.map((k) => ({ v: k, label: KIND_LABEL[k].many === "Articles" ? "Links and articles" : KIND_LABEL[k].many })) },
    mood: { label: "Mood", list: allMoods.map((m) => ({ v: m, label: m, dot: moodColour(m) })) },
    genre: { label: "Genre", list: genres.map((g) => ({ v: g, label: g })) },
    status: { label: "Want to / Done", list: [{ v: "want", label: "Want to" }, { v: "done", label: "Done" }] },
  };
  const keys = (Object.keys(options) as (keyof Filters)[]).filter((k) => (k === "kind" ? kinds.length > 1 : k === "genre" ? genres.length > 0 : true));
  const shown = (k: keyof Filters) => {
    const v = value[k];
    if (!v) return options[k].label;
    const o = options[k].list.find((x) => x.v.toLowerCase() === String(v).toLowerCase());
    return `${k === "status" ? "" : options[k].label + ": "}${o?.label ?? v}`;
  };
  return (
    <>
      <div className="pills" role="group" aria-label="Filters">
        {keys.map((k) => (
          <button key={k} className={"pill" + (value[k] ? " on" : "")} onClick={() => setOpen(k)} aria-label={`${options[k].label} filter${value[k] ? `: ${value[k]}` : ""}`}>
            <span>
              {shown(k)}
              <i className="caret" aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
      {open && (
        <>
          <div className="scrim" onClick={() => setOpen(null)} />
          <div className="dialog" role="dialog" aria-modal="true" aria-label={options[open].label} style={{ maxHeight: "80dvh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 20 }}>{options[open].label}</h2>
            <div className="row" style={{ flexWrap: "wrap", gap: 2 }}>
              <button className={"pill" + (!value[open] ? " on" : "")} onClick={() => (onChange({ ...value, [open]: null, ...(open === "kind" ? { genre: null } : {}) }), setOpen(null))}>
                <span>Any</span>
              </button>
              {options[open].list.map((o) => (
                <button key={o.v} className={"pill" + (String(value[open] ?? "").toLowerCase() === o.v.toLowerCase() ? " on" : "")} onClick={() => (onChange({ ...value, [open]: o.v, ...(open === "kind" ? { genre: null } : {}) }), setOpen(null))}>
                  <span>
                    {o.dot && <i style={{ width: 9, height: 9, borderRadius: "50%", border: "1px solid currentColor", background: o.dot, display: "inline-block" }} />}
                    {o.label}
                  </span>
                </button>
              ))}
            </div>
            {open === "mood" && onEditMoods && (
              <button className="link small" style={{ alignSelf: "flex-start", minHeight: 44 }} onClick={() => (setOpen(null), onEditMoods())}>
                Edit your moods
              </button>
            )}
            <button className="link" style={{ fontWeight: 500 }} onClick={() => setOpen(null)}>Close</button>
          </div>
        </>
      )}
    </>
  );
}

/** a poster tile; with onPick it becomes a tick box for Select */
export function SavedTile({ it, sub, flag, picked, onPick }: { it: Interest; sub?: string; flag?: string; picked?: boolean; onPick?: () => void }) {
  const inner = (
    <>
      <span style={{ position: "relative", display: "block" }}>
        <Poster src={it.image_url} title={it.title} kind={it.kind} />
        {flag && <span className="flag">{flag}</span>}
        {onPick && <span className="box" aria-hidden="true">{picked && <Icon name="check" size={13} width={2.4} />}</span>}
      </span>
      <strong>{it.title}</strong>
      <span className="sub">{sub ?? [kindWord(it.kind), it.moods[0]].filter(Boolean).join(" · ")}</span>
    </>
  );
  return onPick ? (
    <button className="saved-tile" aria-pressed={!!picked} aria-label={it.title} onClick={onPick}>
      {inner}
    </button>
  ) : (
    <Link className="saved-tile" href={`/interest/?id=${it.id}`}>
      {inner}
    </Link>
  );
}

/** a link or article, as a row */
export function SavedRow({ it, sub, picked, onPick }: { it: Interest; sub?: string; picked?: boolean; onPick?: () => void }) {
  const host = it.links[0]?.url ? safeHost(it.links[0].url) : it.creator;
  const body = (
    <>
      <Poster src={it.image_url} title={it.title} kind={it.kind} className="thumb" />
      <span className="grow">
        <strong>{it.title}</strong>
        <span className="sub">{sub ?? ["Link", host, it.moods[0]].filter(Boolean).join(" · ")}</span>
      </span>
      {onPick && <span className="tick" style={{ position: "static", margin: 0, background: picked ? "var(--ink)" : undefined, color: "var(--card)" }} aria-hidden="true">{picked && <Icon name="check" size={13} width={2.4} />}</span>}
    </>
  );
  return onPick ? (
    <button className="item-row" aria-pressed={!!picked} aria-label={it.title} onClick={onPick}>{body}</button>
  ) : (
    <Link className="item-row" href={`/interest/?id=${it.id}`}>{body}</Link>
  );
}

function safeHost(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** a mood list kept in sync with the editor */
export function useMoodList(get: () => string[]) {
  const [moods, setMoods] = useState<string[]>([]);
  useEffect(() => setMoods(get()), [get]);
  return [moods, setMoods] as const;
}
