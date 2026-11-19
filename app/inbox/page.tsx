"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import type { InterestKind, SavedLink } from "@/lib/types";
import { KIND_LABEL } from "@/lib/types";
import { comingBack } from "@/lib/inbox";
import { day, relDay, sameDay, time } from "@/lib/dates";
import { firstUrl, hostOf, linkPicture, recognise } from "@/lib/catalog/links";
import Nav from "@/components/Nav";
import Mascot from "@/components/Mascot";
import Poster from "@/components/Poster";
import Icon from "@/components/Icon";
import { preview } from "@/components/ThoughtCard";

const DAY = 86400000;
const STILL: Record<InterestKind, string> = { film: "Still want to watch?", book: "Still want to read?", music: "Still want to listen?", article: "Still want to read?" };
const DID: Record<InterestKind, string> = { film: "I watched it", book: "I read it", music: "I listened", article: "I read it" };

/** "Not now" hides a card for the rest of the day, on this phone */
const hiddenKey = () => "strata:inbox-hidden:" + new Date().toDateString();
function readHidden(): string[] {
  try {
    return JSON.parse(localStorage.getItem(hiddenKey()) || "[]");
  } catch {
    return [];
  }
}

function ago(iso: string) {
  const weeks = Math.round((Date.now() - new Date(iso).getTime()) / (7 * DAY));
  if (weeks < 9) return `Saved ${weeks} weeks ago`;
  const months = Math.round(weeks / 4.35);
  return months < 12 ? `Saved ${months} months ago` : `Saved ${day(iso)}`;
}

function Inbox() {
  const { store } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const { data, error, reload } = useData(async () => {
    const [thoughts, interests, links] = await Promise.all([store.thoughts(), store.interests(), store.links()]);
    return { thoughts, interests, links };
  }, [store]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [tab, setTab] = useState<"back" | "sort" | null>(params.get("tab") === "sort" ? "sort" : null);
  const [paste, setPaste] = useState("");
  const [filing, setFiling] = useState<SavedLink | null>(null);
  useEffect(() => setHidden(readHidden()), []);

  const hide = (id: string) => {
    const next = [...hidden, id];
    setHidden(next);
    try {
      localStorage.setItem(hiddenKey(), JSON.stringify(next));
    } catch {}
  };

  if (error) return <main className="screen"><p className="error">{error}</p><Nav /></main>;
  if (!data) return <main className="screen"><Nav /></main>;
  const back = comingBack(data.thoughts, data.interests);
  const yearAgo = back.yearAgo.filter((t) => !hidden.includes(t.id));
  const waiting = back.waiting.filter((i) => !hidden.includes(i.id));
  const backCount = yearAgo.length + waiting.length;
  const sortCount = data.links.length;
  const shown = tab ?? (backCount || !sortCount ? "back" : "sort");

  const savePaste = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = firstUrl(paste) ?? (/^[\w-]+(\.[\w-]+)+/.test(paste.trim()) ? "https://" + paste.trim() : null);
    if (!url) return;
    await store.addLink({ url, title: recognise(url).title });
    setPaste("");
    setTab("sort");
    reload();
  };

  const pasteBox = (
    <form className="paste" onSubmit={savePaste}>
      <input type="url" inputMode="url" placeholder="Paste a link to sort later" aria-label="Paste a link" value={paste} onChange={(e) => setPaste(e.target.value)} />
      {paste.trim() && <button className="btn ink">Save</button>}
    </form>
  );

  return (
    <>
      <main className="screen">
        <header className="between">
          <h1 className="h-big">Inbox</h1>
          {(backCount > 0 || sortCount > 0) && (
            <span className="tag butter">
              {backCount} new · {sortCount} to sort
            </span>
          )}
        </header>

        {backCount === 0 && sortCount === 0 ? (
          <>
            <p className="muted" style={{ margin: 0 }}>Things coming back to you, and links you saved to sort later.</p>
            <div className="empty">
              <Mascot size={72} eyes="closed" mouth="smile" />
              <h2>All caught up</h2>
              <p>Nothing is coming back today and nothing needs sorting. Thoughts from a year ago, things you still want to watch, and saved links will show up here.</p>
            </div>
            {pasteBox}
          </>
        ) : (
          <>
            <div className="seg wide" role="group" aria-label="Inbox sections">
              <button aria-pressed={shown === "back"} onClick={() => setTab("back")}>
                Coming back<span className="count">{backCount}</span>
              </button>
              <button aria-pressed={shown === "sort"} onClick={() => setTab("sort")}>
                To sort<span className="count">{sortCount}</span>
              </button>
            </div>

            {shown === "back" && (
              <section className="stack" style={{ gap: 12 }}>
                <div className="between">
                  <h2 style={{ fontSize: 17 }}>Also today</h2>
                  <span className="small muted">Picked by dates, never by AI</span>
                </div>
                {yearAgo.map((t) => {
                  const years = new Date().getFullYear() - new Date(t.created_at).getFullYear();
                  return (
                    <article key={t.id} className="card back-card" style={{ boxShadow: "3px 3px 0 var(--lilac)" }}>
                      <div className="between">
                        <strong style={{ fontWeight: 600 }}>{years === 1 ? "A year ago today" : `${years} years ago today`}</strong>
                        <span className="small muted">{day(t.created_at)}</span>
                      </div>
                      <p className="serif">“{preview(t.body, 200)}”</p>
                      <div className="row">
                        <Link className="btn sm ink" href={`/thought/?id=${t.id}`}>Open</Link>
                        <button className="btn sm" onClick={() => hide(t.id)}>Not now</button>
                      </div>
                    </article>
                  );
                })}
                {waiting.map((i) => (
                  <article key={i.id} className="card back-card">
                    <div className="between">
                      <strong style={{ fontWeight: 600 }}>{STILL[i.kind]}</strong>
                      <span className="small muted">{ago(i.created_at)}</span>
                    </div>
                    <Link href={`/interest/?id=${i.id}`} className="row" style={{ textDecoration: "none" }}>
                      <Poster src={i.image_url} title={i.title} kind={i.kind} className="thumb" />
                      <strong style={{ fontSize: 17, fontWeight: 600 }}>
                        {i.title}
                        {i.year ? ` (${i.year})` : ""}
                      </strong>
                    </Link>
                    <div className="row">
                      <button className="btn sm ink" onClick={async () => (await store.updateInterest(i.id, { status: "done", done_at: new Date().toISOString() }), router.push(`/interest/?id=${i.id}`))}>
                        {DID[i.kind]}
                      </button>
                      <button className="btn sm" onClick={async () => (await store.updateInterest(i.id, { nudged_at: new Date().toISOString() }), reload())}>
                        Keep waiting
                      </button>
                    </div>
                  </article>
                ))}
                {backCount === 0 && <div className="empty"><h2>Nothing coming back today</h2><p>Thoughts from this day in earlier years, and things you saved a while ago, show up here.</p></div>}
              </section>
            )}

            {shown === "sort" && (
              <section className="stack" style={{ gap: 10 }}>
                {pasteBox}
                {sortCount > 0 && (
                  <div className="between">
                    <h2 style={{ fontSize: 17 }}>Links to sort</h2>
                    <span className="small muted">Oldest at the bottom</span>
                  </div>
                )}
                {data.links.map((l) => {
                  const pic = linkPicture(l.url);
                  const r = recognise(l.url, l.title);
                  return (
                    <div key={l.id} className="item-row">
                      {pic ? <Poster src={pic} title={l.title || r.host} kind="article" className="thumb" /> : <span className="link-tile" aria-hidden="true"><Icon name="link" size={18} /></span>}
                      <a className="grow" href={l.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                        <strong>{l.title || r.title}</strong>
                        <span className="sub">
                          {r.host} · {sameDay(new Date(l.created_at), new Date()) ? `today, ${time(new Date(l.created_at))}` : relDay(l.created_at)}
                        </span>
                      </a>
                      <button className="btn sm" onClick={() => setFiling(l)}>File it</button>
                    </div>
                  );
                })}
                {sortCount === 0 && <div className="empty"><h2>Nothing to sort</h2><p>Links you share from other apps, or paste above, land here.</p></div>}
                {sortCount > 0 && <span className="small muted" style={{ textAlign: "center" }}>Links you share from other apps land here.</span>}
              </section>
            )}
          </>
        )}
      </main>
      {filing && <FileIt link={filing} onClose={() => setFiling(null)} onDone={(to) => (setFiling(null), to ? router.push(to) : reload())} />}
      <Nav />
    </>
  );
}

function FileIt({ link, onClose, onDone }: { link: SavedLink; onClose: () => void; onDone: (go?: string) => void }) {
  const { store } = useApp();
  const r = recognise(link.url, link.title);
  const [kind, setKind] = useState<InterestKind>(r.kind);
  const [title, setTitle] = useState(r.title);
  const [busy, setBusy] = useState(false);

  const toInterests = async () => {
    setBusy(true);
    const pic = linkPicture(link.url);
    const it = await store.addInterest({
      kind,
      title: title.trim().slice(0, 500) || r.host,
      year: r.year,
      image_url: kind === r.kind || kind === "article" ? pic : null,
      image_checked: kind === "article" || !!pic,
      source: "link",
      links: [{ url: link.url, title: link.title || r.host, added_at: link.created_at }],
    });
    if (link.note.trim()) await store.addThought({ body: link.note.trim(), kind: "card", finished: true, interest_id: it.id });
    await store.removeLink(link.id);
    onDone(`/interest/?id=${it.id}`);
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-label="File it">
        <h2>File it</h2>
        <p>
          {hostOf(link.url)}
          {r.kind !== "article" ? ` · looks like ${r.label === "film" ? "a film" : r.label === "book" ? "a book" : r.label === "series" ? "a series" : r.label === "song" ? "a song" : r.label === "album" ? "an album" : "music"}` : ""}
        </p>
        <input className="input" aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="chips" role="group" aria-label="Kind" style={{ margin: 0, padding: 0 }}>
          {(["film", "book", "music", "article"] as InterestKind[]).map((k) => (
            <button key={k} className="chip" aria-pressed={k === kind} onClick={() => setKind(k)}>
              {KIND_LABEL[k].one}
            </button>
          ))}
        </div>
        <div className="stack" style={{ gap: 10, marginTop: 4 }}>
          <button className="btn ink block" disabled={busy} onClick={toInterests}>
            Add to interests, {KIND_LABEL[kind].want.toLowerCase()}
          </button>
          <button className="btn block" disabled={busy} onClick={async () => (await store.removeLink(link.id), onDone())}>
            Remove from Inbox
          </button>
          <button className="link" style={{ fontWeight: 500 }} onClick={onClose}>
            Leave it for now
          </button>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Inbox />
    </Suspense>
  );
}
