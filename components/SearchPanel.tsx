"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/app/providers";
import type { Interest, Thought } from "@/lib/types";
import Poster from "@/components/Poster";
import { details } from "@/lib/interests";
import Icon from "@/components/Icon";
import Mascot from "@/components/Mascot";
import ThoughtCard from "@/components/ThoughtCard";
import type { ReactNode } from "react";

const RECENT = "strata:recent-searches";
const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT) || "[]");
  } catch {
    return [];
  }
};

/** the search box and its results; used as a page and as the panel that slides in */
export function SearchPanel({ close }: { close: ReactNode }) {
  const { store } = useApp();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Thought[] | null>(null);
  const [items, setItems] = useState<Interest[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(readRecent()), []);

  useEffect(() => {
    const term = q.trim();
    if (!term) return setResults(null);
    const t = setTimeout(async () => {
      const words = term.toLowerCase().split(/\s+/);
      const [found, all] = await Promise.all([store.search(term), store.interests()]);
      setItems(all.filter((i) => words.every((w) => (i.title + " " + i.creator + " " + i.moods.join(" ") + " " + (i.genres ?? []).join(" ")).toLowerCase().includes(w))).slice(0, 8));
      setResults(found);
      const next = [term, ...readRecent().filter((r) => r.toLowerCase() !== term.toLowerCase())].slice(0, 6);
      try {
        localStorage.setItem(RECENT, JSON.stringify(next));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [q, store]);

  const chips = (
    <div className="row" style={{ flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
      {recent.map((r) => (
        <button key={r} className="tag" style={{ minHeight: 36, fontWeight: 500, padding: "6px 14px" }} onClick={() => setQ(r)}>
          {r}
        </button>
      ))}
    </div>
  );

  return (
    <>
        <div className="row">
          <label className="search-box grow">
            <Icon name="search" size={18} />
            <input type="search" autoFocus placeholder="Thoughts, films, books…" aria-label="Search your archive" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {close}
        </div>
        {results === null && (
          <div className="stack" style={{ gap: 10, alignItems: "center", marginTop: 20 }}>
            <span className="muted">Search words from a thought or a topic.</span>
            {recent.length > 0 && (
              <>
                <span className="small muted" style={{ marginTop: 10 }}>You searched for these lately</span>
                {chips}
              </>
            )}
          </div>
        )}
        {results && items.length > 0 && (
          <div className="stack" style={{ gap: 8 }}>
            <span className="muted" style={{ fontSize: 13 }}>In what you saved</span>
            {items.map((i) => (
              <Link key={i.id} href={`/interest/?id=${i.id}`} className="item-row">
                <Poster src={i.image_url} title={i.title} kind={i.kind} className="thumb" />
                <span className="grow">
                  <strong>{i.title}</strong>
                  <span className="sub">{details(i)}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
        {results && results.length > 0 && (
          <>
            <span className="muted" style={{ fontSize: 13 }}>
              {results.length} {results.length === 1 ? "thought" : "thoughts"} with “{q.trim()}”
            </span>
            <div className="stack">
              {results.map((t) => (
                <ThoughtCard key={t.id} t={t} />
              ))}
            </div>
          </>
        )}
        {results && results.length === 0 && items.length === 0 && (
          <div className="empty">
            <Mascot size={72} eyes="look" mouth="flat" arms="chin" tilt={-5} />
            <h2>Nothing for “{q.trim()}”</h2>
            <p>Check the spelling, or try a word from the thought itself. Sealed capsules stay out of search.</p>
            <button className="btn ink" style={{ marginTop: 8 }} onClick={() => setQ("")}>
              Clear the search
            </button>
          </div>
        )}
    </>
  );
}

