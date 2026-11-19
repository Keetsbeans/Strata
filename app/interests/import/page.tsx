"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../providers";
import type { ImportResult } from "@/lib/store/types";
import { readShelfFile, type ImportSummary } from "@/lib/catalog/importShelf";
import Icon from "@/components/Icon";
import Mascot from "@/components/Mascot";

const FROM = {
  letterboxd: {
    name: "Letterboxd",
    what: "Films",
    steps: [
      <>On letterboxd.com, open <strong>Settings</strong>, then <strong>Data</strong>, and tap <strong>Export your data</strong>.</>,
      <>It saves a .zip file. Come back here and pick it.</>,
    ],
    accept: ".zip,.csv,application/zip,text/csv",
    things: ["films watched", "on your watchlist"],
    one: "film",
    many: "films",
    later: "The watchlist lands in Inbox now and then as “Still want to watch?”",
  },
  goodreads: {
    name: "Goodreads",
    what: "Books",
    steps: [
      <>On goodreads.com, open <strong>My Books</strong>, then <strong>Import and export</strong>, and tap <strong>Export library</strong>.</>,
      <>When it&apos;s ready, save the .csv file, come back here and pick it.</>,
    ],
    accept: ".csv,.zip,text/csv",
    things: ["books read", "on your to-read shelf"],
    one: "book",
    many: "books",
    later: "Your to-read shelf lands in Inbox now and then as “Still want to read?”",
  },
} as const;

export default function Import() {
  const { store } = useApp();
  const router = useRouter();
  const [from, setFrom] = useState<"letterboxd" | "goodreads">("letterboxd");
  const [found, setFound] = useState<ImportSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ImportResult | null>(null);
  const F = FROM[from];
  const total = found ? found.done + found.want : 0;

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError("");
    setFound(null);
    try {
      const s = await readShelfFile(f, from);
      if (s.data.source !== from) setFrom(s.data.source);
      if (!s.data.items.length) throw new Error("Nothing to bring in from that file.");
      setFound(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    }
  };

  const bring = async () => {
    if (!found) return;
    setBusy(true);
    setError("");
    try {
      setDone(await store.importShelf(found.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  };

  if (done)
    return (
      <main className="screen no-nav" style={{ justifyContent: "center" }}>
        <div className="empty" style={{ borderStyle: "solid", background: "var(--card)" }}>
          <Mascot size={72} eyes="happy" mouth="grin" arms="up" />
          <h2>Your shelf is in</h2>
          <p>
            {done.added} new {done.added === 1 ? F.one : F.many}
            {done.updated ? `, ${done.updated} you already had` : ""}
            {done.thoughts ? `, and ${done.thoughts} ${done.thoughts === 1 ? "review" : "reviews"} as thoughts` : ""}. Posters and covers fill in as you scroll.
          </p>
          <Link className="btn ink" style={{ marginTop: 8 }} href={`/interests/?kind=${from === "letterboxd" ? "film" : "book"}`}>
            See your {F.many}
          </Link>
        </div>
      </main>
    );

  return (
    <main className="screen no-nav" style={{ gap: 14 }}>
      <header className="between">
        <button className="icon-btn round" aria-label="Back" onClick={() => router.back()}>
          <Icon name="back" />
        </button>
        <h1 className="h-mid">Bring your shelf</h1>
        <span style={{ width: 48 }} aria-hidden="true" />
      </header>
      <p className="muted" style={{ margin: 0, fontSize: 15 }}>
        Already log films or books somewhere else? Bring them here so you don&apos;t start from an empty shelf.
      </p>
      <div role="group" aria-label="Import from" className="row" style={{ gap: 10 }}>
        {(["letterboxd", "goodreads"] as const).map((k) => (
          <button
            key={k}
            aria-pressed={from === k}
            className="card stack grow"
            style={{ gap: 2, flex: "1 1 0", minHeight: 64, textAlign: "left", borderWidth: from === k ? 2 : 1, background: from === k ? "var(--blue)" : "var(--card)" }}
            onClick={() => (setFrom(k), setFound(null), setError(""))}
          >
            <strong style={{ fontSize: 15, fontWeight: 600 }}>{FROM[k].name}</strong>
            <span className="small muted">{FROM[k].what}</span>
          </button>
        ))}
      </div>
      <ol className="stack" style={{ margin: 0, padding: 0, listStyle: "none", gap: 10 }}>
        {F.steps.map((s, i) => (
          <li key={i} className="row" style={{ alignItems: "flex-start" }}>
            <span className="step-n">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <label className="file-drop" style={{ position: "relative" }}>
        <Icon name="download" size={20} />
        <span className="grow" style={{ fontWeight: 600 }}>{found ? found.file : `Pick the ${from === "letterboxd" ? ".zip" : ".csv"} file`}</span>
        {found && <span className="small" style={{ textDecoration: "underline" }}>Change</span>}
        <input type="file" accept={F.accept} onChange={pick} aria-label={`Pick your ${F.name} export file`} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      {found && (
        <section aria-label="What we found" className="card stack" style={{ gap: 10 }}>
          <strong style={{ fontSize: 15, fontWeight: 600 }}>Found in your file</strong>
          <div className="row" style={{ gap: 8, alignItems: "stretch" }}>
            <span className="stat" style={{ background: "var(--blue)" }}><strong>{found.done}</strong><span className="small">{F.things[0]}</span></span>
            <span className="stat" style={{ background: "var(--butter)" }}><strong>{found.want}</strong><span className="small">{F.things[1]}</span></span>
            <span className="stat" style={{ background: "var(--lilac)" }}><strong>{found.reviews}</strong><span className="small">reviews</span></span>
          </div>
          <span style={{ fontSize: 13, lineHeight: 1.45 }}>
            Your reviews come in as thoughts, pinned to their {F.one} with the date you wrote them. {F.later} Bringing the same file in twice adds nothing twice.
          </span>
        </section>
      )}
      <div className="grow" />
      <span className="row small muted" style={{ alignItems: "flex-start", gap: 8 }}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 16px" }}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        Your file is read on this phone. Strata never signs in to Letterboxd or Goodreads. Posters are looked up later by title only.
      </span>
      <button className="btn ink block shadow" disabled={!found || busy} onClick={bring} style={{ minHeight: 52 }}>
        {busy ? "Bringing them in…" : found ? `Add ${total} ${total === 1 ? F.one : F.many} to my interests` : `Pick your ${F.name} file first`}
      </button>
    </main>
  );
}
