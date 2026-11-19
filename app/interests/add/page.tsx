"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../../providers";
import { useData } from "@/lib/useData";
import type { InterestKind } from "@/lib/types";
import { KIND_LABEL } from "@/lib/types";
import { details } from "@/lib/interests";
import { normTitle } from "@/lib/catalog/match";
import { filmSource, searchKind, type CatalogHit } from "@/lib/catalog/search";
import { firstUrl, linkPicture, recognise } from "@/lib/catalog/links";
import Icon from "@/components/Icon";
import Poster from "@/components/Poster";

const KINDS: InterestKind[] = ["film", "book", "music", "article"];

function Add() {
  const { store } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const [kind, setKind] = useState<InterestKind>((KINDS.includes(params.get("kind") as InterestKind) ? params.get("kind") : "film") as InterestKind);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [hits, setHits] = useState<CatalogHit[] | null>(null);
  const [looking, setLooking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [link, setLink] = useState("");
  const [byHand, setByHand] = useState(false);
  const [hand, setHand] = useState({ title: "", creator: "", year: "" });
  const [busy, setBusy] = useState(false);
  const { data: mine } = useData(() => store.interests(), [store]);

  useEffect(() => {
    const term = q.trim();
    setFailed(false);
    if (term.length < 2 || kind === "article") return setHits(null);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setLooking(true);
      searchKind(kind, term, ctl.signal)
        .then((h) => !ctl.signal.aborted && setHits(h))
        .catch(() => !ctl.signal.aborted && (setHits([]), setFailed(true)))
        .finally(() => !ctl.signal.aborted && setLooking(false));
    }, 450);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, kind]);

  const term = normTitle(q);
  const already = term.length >= 2 ? (mine ?? []).filter((i) => normTitle(i.title).includes(term)).slice(0, 4) : [];
  const owned = (h: CatalogHit) => (mine ?? []).some((i) => i.kind === h.kind && normTitle(i.title) === normTitle(h.title) && (!i.year || !h.year || i.year === h.year));

  const add = async (h: CatalogHit) => {
    setBusy(true);
    const it = await store.addInterest({ kind: h.kind, title: h.title, creator: h.creator, year: h.year, image_url: h.image_url, image_checked: true, source: h.source, source_id: h.source_id });
    router.replace(`/interest/?id=${it.id}`);
  };
  const addLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = firstUrl(link) ?? (/^[\w-]+(\.[\w-]+)+/.test(link.trim()) ? "https://" + link.trim() : null);
    if (!url) return;
    setBusy(true);
    const r = recognise(url);
    const pic = linkPicture(url);
    const it = await store.addInterest({
      kind: r.kind,
      title: r.title,
      year: r.year,
      image_url: pic,
      image_checked: !!pic || r.kind === "article",
      source: "link",
      links: [{ url, title: r.host, added_at: new Date().toISOString() }],
    });
    router.replace(`/interest/?id=${it.id}`);
  };
  const addByHand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hand.title.trim()) return;
    setBusy(true);
    const year = Number(hand.year) || null;
    const it = await store.addInterest({ kind, title: hand.title.trim().slice(0, 500), creator: hand.creator.trim().slice(0, 500), year: year && year > 1000 && year < 3000 ? year : null });
    router.replace(`/interest/?id=${it.id}`);
  };

  return (
    <main className="screen no-nav">
      <header className="between">
        <button className="icon-btn round" aria-label="Back" onClick={() => router.back()}>
          <Icon name="back" />
        </button>
        <h1 className="h-mid">Add to interests</h1>
        <span style={{ width: 48 }} aria-hidden="true" />
      </header>
      <div className="chips" role="group" aria-label="Kind">
        {KINDS.map((k) => (
          <button key={k} className="chip" aria-pressed={k === kind} onClick={() => setKind(k)}>
            {KIND_LABEL[k].one}
          </button>
        ))}
      </div>
      {kind !== "article" && (
        <label className="search-box">
          <Icon name="search" size={18} />
          <input type="search" autoFocus placeholder={`Search ${kind === "film" ? "films" : kind === "book" ? "books" : "albums and songs"}`} aria-label="Search by title" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      )}

      {already.length > 0 && (
        <section className="stack" style={{ gap: 10 }}>
          <h2 style={{ fontSize: 15 }}>Already in your interests</h2>
          {already.map((i) => (
            <div key={i.id} className="item-row">
              <Poster src={i.image_url} title={i.title} kind={i.kind} className="thumb" />
              <span className="grow">
                <strong>{i.title}</strong>
                <span className="sub">{details(i)}</span>
              </span>
              <Link className="btn sm" href={`/interest/?id=${i.id}`}>Open</Link>
            </div>
          ))}
        </section>
      )}

      {kind !== "article" && q.trim().length >= 2 && (
        <section className="stack" style={{ gap: 10 }} aria-live="polite">
          <h2 style={{ fontSize: 15 }}>From {kind === "film" ? "film" : kind === "book" ? "book" : "music"} lists</h2>
          {looking && !hits?.length && <span className="muted">Looking…</span>}
          {failed && <span className="error">Couldn&apos;t reach the {kind} list. Check your connection, or type it in by hand below.</span>}
          {hits?.length === 0 && !failed && !looking && <span className="muted">Nothing found for “{q.trim()}”. Try fewer words, or type it in by hand.</span>}
          {hits?.map((h) => (
            <div key={h.source_id} className="item-row">
              <Poster src={h.image_url} title={h.title} kind={h.kind} className="thumb" />
              <span className="grow">
                <strong>{h.title}</strong>
                <span className="sub">{details(h, h.label)}</span>
              </span>
              {owned(h) ? (
                <span className="small muted" style={{ padding: "0 8px" }}>Added</span>
              ) : (
                <button className="btn sm" disabled={busy} onClick={() => add(h)}>Add</button>
              )}
            </div>
          ))}
          <span className="small muted">
            Searched in public lists: films from {filmSource}, books from Open Library, music from MusicBrainz. Only the title you type is sent, never your thoughts.
          </span>
        </section>
      )}

      <section className="stack" style={{ gap: 10 }}>
        <h2 style={{ fontSize: 15 }}>{kind === "article" ? "Save an article, video or page" : "Or bring it in another way"}</h2>
        <form className="paste" onSubmit={addLink}>
          <input type="url" inputMode="url" placeholder="Paste a link from anywhere" aria-label="Paste a link" value={link} onChange={(e) => setLink(e.target.value)} />
          <button className="btn ink" disabled={!link.trim() || busy}>Add</button>
        </form>
        {!byHand ? (
          <button className="btn block" onClick={() => setByHand(true)}>Type it in by hand</button>
        ) : (
          <form className="card stack" style={{ gap: 10 }} onSubmit={addByHand}>
            <input className="input" placeholder="Title" aria-label="Title" value={hand.title} onChange={(e) => setHand({ ...hand, title: e.target.value })} autoFocus />
            <input className="input" placeholder={kind === "film" ? "Director (optional)" : kind === "book" ? "Author (optional)" : kind === "music" ? "Artist (optional)" : "Where it's from (optional)"} aria-label="Made by" value={hand.creator} onChange={(e) => setHand({ ...hand, creator: e.target.value })} />
            <input className="input" placeholder="Year (optional)" aria-label="Year" inputMode="numeric" value={hand.year} onChange={(e) => setHand({ ...hand, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
            <button className="btn ink block" disabled={!hand.title.trim() || busy}>Add {KIND_LABEL[kind].one.toLowerCase()}</button>
          </form>
        )}
      </section>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Add />
    </Suspense>
  );
}
