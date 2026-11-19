"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import type { Interest } from "@/lib/types";
import { KIND_LABEL } from "@/lib/types";
import { details } from "@/lib/interests";
import { connectionsFor } from "@/lib/connections";
import { preview } from "@/components/ThoughtCard";
import { day, time } from "@/lib/dates";
import { getMoods, moodColour, setMoods } from "@/lib/moods";
import { genreChoices } from "@/lib/genres";
import LabelPicker from "@/components/LabelPicker";
import { usePictureFill } from "@/lib/catalog/pictures";
import { firstUrl, hostOf } from "@/lib/catalog/links";
import Icon from "@/components/Icon";
import SlideSeg from "@/components/SlideSeg";
import Poster, { Dots } from "@/components/Poster";
import Dialog from "@/components/Dialog";
import { CollectionPicker, ThoughtPicker } from "@/components/Pickers";

const THE_DAY = { film: "the day you watched it", book: "the day you finished it", music: "the day you heard it", article: "the day you read it" };


function ItemView() {
  const { store } = useApp();
  const router = useRouter();
  const id = useSearchParams().get("id") || "";
  const { data, error, reload, setData } = useData(async () => {
    const [it, thoughts, collections, all, threads] = await Promise.all([store.interest(id), store.thoughts(), store.collections(), store.interests(), store.threads()]);
    const usedGenres = [...new Set(all.filter((x) => x.kind === it?.kind).flatMap((x) => x.genres ?? []))];
    const item = it && { ...it, genres: it.genres ?? [] };
    return { it: item, thoughts, collections, usedGenres, threadTitle: new Map(threads.map((x) => [x.id, x.title])), links: item ? connectionsFor(item, all, thoughts, collections) : { items: [], thoughts: [] } };
  }, [store, id]);
  const [moods, setMoodList] = useState<string[]>([]);
  const [open, setOpen] = useState<null | "mood" | "genre">(null);
  const [link, setLink] = useState("");
  const [sheet, setSheet] = useState<null | "collection" | "pin" | "remove" | "edit">(null);
  const [allThoughts, setAllThoughts] = useState(false);
  const [edit, setEdit] = useState({ title: "", creator: "", year: "" });
  useEffect(() => setMoodList(getMoods()), []);

  const one = data?.it ? [data.it] : null;
  usePictureFill(store, one, (it) => setData((d) => d && { ...d, it: { ...it } }));

  if (error) return <main className="screen no-nav"><p className="error">{error}</p></main>;
  if (!data) return <main className="screen no-nav" />;
  const { it, thoughts, collections } = data;
  if (!it)
    return (
      <main className="screen no-nav">
        <p className="error">This isn&apos;t in what you saved any more.</p>
        <Link className="btn" href="/interests/">Back to Saved</Link>
      </main>
    );
  const L = KIND_LABEL[it.kind];
  const pinned = thoughts.filter((t) => t.interest_id === it.id && t.finished);
  const oldest = pinned[pinned.length - 1];
  const inside = collections.filter((c) => c.items.some((x) => x.interest_id === it.id));

  const patch = async (p: Partial<Interest>) => {
    const next = await store.updateInterest(it.id, p);
    setData((d) => d && { ...d, it: { ...next } });
  };
  const addLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = firstUrl(link) ?? (/^[\w-]+(\.[\w-]+)+/.test(link.trim()) ? "https://" + link.trim() : null);
    if (!url) return;
    await patch({ links: [...it.links, { url, title: hostOf(url), added_at: new Date().toISOString() }] });
    setLink("");
  };
  const status = (s: Interest["status"]) => patch({ status: s, done_at: s === "done" ? it.done_at ?? new Date().toISOString() : null });

  return (
    <main className="screen no-nav" style={{ gap: 20 }}>
      <header className="between">
        <button className="icon-btn round" aria-label="Back" onClick={() => router.back()}>
          <Icon name="back" />
        </button>
        <SlideSeg label="Status" dep={it.status}>
          <button aria-pressed={it.status === "want"} onClick={() => status("want")}>{L.want}</button>
          <button aria-pressed={it.status === "done"} onClick={() => status("done")}>{L.done}</button>
        </SlideSeg>
        <button
          className="icon-btn round"
          aria-label={it.favourite ? "Remove from favourites" : "Add to favourites"}
          aria-pressed={it.favourite}
          style={{ background: it.favourite ? "var(--lilac)" : "var(--card)" }}
          onClick={() => patch({ favourite: !it.favourite })}
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill={it.favourite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.4-7.5 10-7.5 10z" />
          </svg>
        </button>
      </header>

      <div className="row" style={{ gap: 20, alignItems: "flex-end" }}>
        <Poster src={it.image_url} title={it.title} kind={it.kind} className="hero" />
        <div className="stack" style={{ gap: 8, minWidth: 0 }}>
          <h1 className="h-title" style={{ overflowWrap: "anywhere" }}>{it.title}</h1>
          <span className="small muted">{details(it)}</span>
          <Dots value={it.rating} onChange={(r) => patch({ rating: r })} />
          {inside.length > 0 && (
            <p className="small muted" style={{ margin: 0 }}>
              In:{" "}
              {inside.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ", "}
                  <Link href={`/collection/?id=${c.id}`} style={{ color: "var(--ink)" }}>{c.title}</Link>
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      <section className="stack" style={{ gap: 10 }} aria-label="Mood and genre">
        {(["mood", "genre"] as const).map((which) => {
          const list = which === "mood" ? it.moods : it.genres;
          const field = which === "mood" ? "moods" : "genres";
          return (
            <div key={which} className="stack" style={{ gap: 8 }}>
              <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                <span className="small" style={{ fontWeight: 600, width: 48 }}>{which === "mood" ? "Mood" : "Genre"}</span>
                {list.map((m) => (
                  <button key={m} className="mood" style={{ minHeight: 44 }} aria-label={`Remove ${which} ${m}`} onClick={() => patch({ [field]: list.filter((x) => x !== m) })}>
                    {which === "mood" && <i style={{ background: moodColour(m) }} />}
                    {m}
                    <span aria-hidden="true" style={{ marginLeft: 2, opacity: 0.6 }}>×</span>
                  </button>
                ))}
                <button className="mood" style={{ borderStyle: "dashed", background: "transparent", fontWeight: 500, minHeight: 44 }} onClick={() => setOpen(open === which ? null : which)} aria-expanded={open === which}>
                  {open === which ? "Done" : which === "mood" ? "Add mood" : "Add genre"}
                </button>
              </div>
              {open === which && (
                <LabelPicker
                  choices={which === "mood" ? moods : genreChoices(it.kind, data.usedGenres)}
                  chosen={list}
                  dot={which === "mood" ? moodColour : undefined}
                  placeholder={which === "mood" ? "Type your own mood" : "Type your own genre"}
                  onAdd={(l) => {
                    if (which === "mood" && !moods.some((m) => m.toLowerCase() === l.toLowerCase())) {
                      const next = [...moods, l];
                      setMoods(next);
                      setMoodList(next);
                    }
                    patch({ [field]: [...list, l] });
                  }}
                />
              )}
            </div>
          );
        })}
      </section>

      <section aria-label="Links" className="stack" style={{ gap: 8 }}>
        {it.links.map((l, i) => (
          <div key={l.url + i} className="item-row" style={{ paddingRight: 6 }}>
            <span className="link-tile" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
            </span>
            <a className="grow" href={l.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <strong>{l.title || hostOf(l.url)}</strong>
              <span className="sub">{hostOf(l.url)}</span>
            </a>
            <button className="icon-btn" style={{ border: 0, background: "transparent" }} aria-label={`Remove link ${l.title || hostOf(l.url)}`} onClick={() => patch({ links: it.links.filter((_, j) => j !== i) })}>
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
        <form className="paste" onSubmit={addLink}>
          <input type="url" inputMode="url" placeholder="Paste a link: a trailer, a review, a song" aria-label="Paste a link" value={link} onChange={(e) => setLink(e.target.value)} />
          {link.trim() && <button className="btn ink">Save</button>}
        </form>
      </section>

      <section className="card stack" style={{ gap: 12, padding: "14px 16px 16px" }} aria-label="Your thoughts on this">
        <div className="between">
          <h2 style={{ fontSize: 16, letterSpacing: "-0.01em" }}>Your thoughts on this</h2>
          {pinned.length > 0 && <span className="small muted">{pinned.length} {pinned.length === 1 ? "thought" : "thoughts"}</span>}
        </div>
        {pinned.length > 0 && <span className="small muted" style={{ marginTop: -8 }}>Newest first. Tap one to open it.</span>}
        {pinned.slice(0, allThoughts ? undefined : 3).map((t) => {
          const d = new Date(t.created_at);
          const note = t === oldest && it.done_at && day(it.done_at) === day(d) ? THE_DAY[it.kind] : "";
          const th = t.thread_id ? data.threadTitle.get(t.thread_id) : null;
          return (
            <Link key={t.id} href={`/thought/?id=${t.id}`} className="stack" style={{ gap: 3, textDecoration: "none", borderTop: "1px dashed var(--ink)", paddingTop: 10 }}>
              <span className="small muted">
                <strong style={{ color: "var(--ink)" }}>{day(d)}</strong>
                {th ? ` · In “${th}”` : ""}
                {note ? ` · ${note}` : ""}
                {t.source ? ` · from ${t.source === "letterboxd" ? "Letterboxd" : "Goodreads"}` : ""}
              </span>
              <span className="serif clamp2" style={{ fontSize: 16, lineHeight: 1.35 }}>{t.body}</span>
            </Link>
          );
        })}
        {pinned.length > 3 && (
          <button className="link small" style={{ alignSelf: "flex-start", minHeight: 44 }} onClick={() => setAllThoughts(!allThoughts)}>
            {allThoughts ? "Show fewer" : `See more (${pinned.length - 3})`}
          </button>
        )}
        {pinned.length === 0 && <span className="muted small">Nothing written about it yet. What did it leave you with?</span>}
        <Link className="btn block ink" href={`/write/?interest=${it.id}`} style={{ minHeight: 46 }}>
          {pinned.length ? "Write about this" : "Write a thought about it"}
        </Link>
        <button className="link small" style={{ fontWeight: 500, minHeight: 44 }} onClick={() => setSheet("pin")}>
          Pin a thought you already wrote
        </button>
      </section>

      <section className="stack" style={{ gap: 8 }} aria-label="Connected">
        <h2 style={{ fontSize: 17, letterSpacing: "-0.01em" }}>Connected</h2>
        {data.links.items.length + data.links.thoughts.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            Give the thoughts you pin here a topic, or add this to a collection, and things that share them show up here.
          </p>
        ) : (
          <>
            {data.links.items.length > 0 && (
              <div className="connected">
                {data.links.items.map(({ item: o, why }) => (
                  <Link key={o.id} href={`/interest/?id=${o.id}`} className="shelf-item" style={{ flex: "0 0 104px" }}>
                    <Poster src={o.image_url} title={o.title} kind={o.kind} />
                    <span className="small" style={{ fontWeight: 600, lineHeight: 1.2 }}>{o.title}</span>
                    <span className="small muted">{why}</span>
                  </Link>
                ))}
              </div>
            )}
            {data.links.thoughts.map(({ thought: t, why }) => (
              <Link key={t.id} href={`/thought/?id=${t.id}`} className="item-row">
                <span className="link-tile" aria-hidden="true">
                  <Icon name="pen" size={16} />
                </span>
                <span className="grow">
                  <strong>{preview(t.body, 60)}</strong>
                  <span className="sub">Thought · also about {why}</span>
                </span>
              </Link>
            ))}
          </>
        )}
      </section>

      <section className="stack" style={{ gap: 8 }}>
        <h2 style={{ fontSize: 15 }}>Collections</h2>
        {inside.map((c) => (
          <Link key={c.id} href={`/collection/?id=${c.id}`} className="card between" style={{ textDecoration: "none" }}>
            <strong style={{ fontWeight: 600 }}>{c.title}</strong>
            <span className="small muted">{c.items.length} things</span>
          </Link>
        ))}
        <button className="btn block" onClick={() => setSheet("collection")}>Add to a collection</button>
      </section>

      <div className="row" style={{ justifyContent: "center", flexWrap: "wrap", gap: 4 }}>
        <button className="link" style={{ fontWeight: 500 }} onClick={() => (setEdit({ title: it.title, creator: it.creator, year: it.year ? String(it.year) : "" }), setSheet("edit"))}>
          Fix the details
        </button>
        <span className="muted" aria-hidden="true">·</span>
        <button className="link" style={{ fontWeight: 500 }} onClick={() => setSheet("remove")}>
          Remove from Saved
        </button>
      </div>

      {sheet === "collection" && (
        <CollectionPicker
          store={store}
          inside={inside.map((c) => c.id)}
          onClose={() => setSheet(null)}
          onPick={async (cid) => {
            await store.addToCollection(cid, { interest_id: it.id });
            setSheet(null);
            reload();
          }}
        />
      )}
      {sheet === "pin" && (
        <ThoughtPicker
          title="Pin a thought"
          sub={`Pick a thought to show on ${it.title}'s page.`}
          thoughts={thoughts.filter((t) => t.finished && t.interest_id !== it.id)}
          onClose={() => setSheet(null)}
          onPick={async (tid) => {
            await store.updateThought(tid, { interest_id: it.id });
            setSheet(null);
            reload();
          }}
        />
      )}
      {sheet === "edit" && (
        <Dialog
          title="Fix the details"
          onClose={() => setSheet(null)}
          actions={
            <>
              <button
                className="btn ink block"
                disabled={!edit.title.trim()}
                onClick={async () => {
                  const year = Number(edit.year) || null;
                  const changed = edit.title.trim() !== it.title || (year ?? null) !== it.year;
                  // a new title or year looks for the right picture again
                  await patch({ title: edit.title.trim().slice(0, 500), creator: edit.creator.trim().slice(0, 500), year: year && year > 1000 && year < 3000 ? year : null, ...(changed && it.kind !== "article" ? { image_url: null, image_checked: false } : {}) });
                  setSheet(null);
                }}
              >
                Save
              </button>
              <button className="btn block" onClick={() => setSheet(null)}>Cancel</button>
            </>
          }
        >
          <div className="stack" style={{ gap: 8 }}>
            <input className="input" aria-label="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            <input className="input" aria-label="Made by" placeholder="Made by" value={edit.creator} onChange={(e) => setEdit({ ...edit, creator: e.target.value })} />
            <input className="input" aria-label="Year" placeholder="Year" inputMode="numeric" value={edit.year} onChange={(e) => setEdit({ ...edit, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
          </div>
        </Dialog>
      )}
      {sheet === "remove" && (
        <Dialog
          title={`Remove ${it.title}?`}
          body={pinned.length ? `Your ${pinned.length === 1 ? "thought about it stays" : `${pinned.length} thoughts about it stay`} in Thoughts, just no longer pinned to it.` : "It comes off your shelf and out of any collection."}
          face="worried"
          onClose={() => setSheet(null)}
          actions={
            <>
              <button
                className="btn ink block"
                onClick={async () => {
                  await store.deleteInterest(it.id);
                  router.replace(`/interests/?kind=${it.kind}`);
                }}
              >
                Remove it
              </button>
              <button className="btn block" onClick={() => setSheet(null)}>Keep it</button>
            </>
          }
        />
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ItemView />
    </Suspense>
  );
}
