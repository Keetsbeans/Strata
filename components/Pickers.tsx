"use client";
import { useEffect, useState } from "react";
import type { Collection, Interest, Thought } from "@/lib/types";
import type { Store } from "@/lib/store/types";
import { details } from "@/lib/interests";
import { normTitle } from "@/lib/catalog/match";
import Poster from "./Poster";
import { preview } from "./ThoughtCard";
import { stamp } from "@/lib/dates";

function Sheet({ label, children, onClose }: { label: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-label={label} style={{ maxHeight: "82dvh", overflowY: "auto" }}>
        {children}
        <button className="btn block" onClick={onClose}>Cancel</button>
      </div>
    </>
  );
}

/** pick one of your collections, or start a new one */
export function CollectionPicker({ store, onPick, onClose, inside = [] }: { store: Store; onPick: (id: string) => void; onClose: () => void; inside?: string[] }) {
  const [list, setList] = useState<Collection[] | null>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    store.collections().then(setList);
  }, [store]);
  return (
    <Sheet label="Add to a collection" onClose={onClose}>
      <h2>Add to a collection</h2>
      <p>A shelf of things that belong together.</p>
      <div className="stack" style={{ gap: 8 }}>
        {list?.map((c) => (
          <button key={c.id} className="card between" style={{ textAlign: "left" }} disabled={inside.includes(c.id)} onClick={() => onPick(c.id)}>
            <strong style={{ fontWeight: 600, fontSize: 16 }}>{c.title}</strong>
            {inside.includes(c.id) && <span className="small muted">Already in it</span>}
          </button>
        ))}
        {list?.length === 0 && <span className="muted">No collections yet. Name your first one below.</span>}
      </div>
      <form
        className="stack"
        style={{ gap: 8 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const c = await store.addCollection(name.trim().slice(0, 200));
          onPick(c.id);
        }}
      >
        <label className="small" style={{ fontWeight: 600 }} htmlFor="new-coll">Or start a new collection</label>
        <div className="row">
          <input id="new-coll" className="input" placeholder="Like Films that stayed with me" value={name} onChange={(e) => setName(e.target.value)} style={{ minHeight: 48 }} />
          <button className="btn ink" disabled={!name.trim()}>Start</button>
        </div>
      </form>
    </Sheet>
  );
}

/** pin a thought to a film, book, song or article */
export function InterestPicker({ store, onPick, onClose }: { store: Store; onPick: (id: string) => void; onClose: () => void }) {
  const [list, setList] = useState<Interest[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    store.interests().then(setList);
  }, [store]);
  const term = normTitle(q);
  const shown = (list ?? []).filter((i) => !term || normTitle(i.title).includes(term) || i.creator.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
  return (
    <Sheet label="Pin to an interest" onClose={onClose}>
      <h2>What is it about?</h2>
      <p>Pin it to a film, book, song or article. It shows up on that item&apos;s page.</p>
      {(list?.length ?? 0) > 6 && <input className="input" placeholder="Find by title" aria-label="Find by title" value={q} onChange={(e) => setQ(e.target.value)} />}
      <div className="stack" style={{ gap: 8 }}>
        {shown.map((i) => (
          <button key={i.id} className="item-row" onClick={() => onPick(i.id)}>
            <Poster src={i.image_url} title={i.title} kind={i.kind} className="thumb" />
            <span className="grow">
              <strong>{i.title}</strong>
              <span className="sub">{details(i)}</span>
            </span>
          </button>
        ))}
        {list?.length === 0 && <span className="muted">Nothing saved yet. Add a film, book or song first.</span>}
      </div>
    </Sheet>
  );
}

/** pick thoughts you already wrote */
export function ThoughtPicker({ thoughts, title, sub, onPick, onClose }: { thoughts: Thought[]; title: string; sub: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <Sheet label={title} onClose={onClose}>
      <h2>{title}</h2>
      <p>{sub}</p>
      <div className="stack" style={{ gap: 8 }}>
        {thoughts.slice(0, 40).map((t) => (
          <button key={t.id} className="card stack" style={{ gap: 4, textAlign: "left" }} onClick={() => onPick(t.id)}>
            <span className="small muted">{stamp(t.created_at)}</span>
            <span className="serif" style={{ fontSize: 16, lineHeight: 1.3 }}>{preview(t.body, 100)}</span>
          </button>
        ))}
        {thoughts.length === 0 && <span className="muted">No thoughts to pick from yet.</span>}
      </div>
    </Sheet>
  );
}

/** link a word in a thought to one of your collections or a saved film, book, song or article. Starts with a search on that word. */
export function WordLinkPicker({ store, word, onPick, onClose }: { store: Store; word: string; onPick: (kind: "collection" | "interest", id: string) => void; onClose: () => void }) {
  const [cols, setCols] = useState<Collection[] | null>(null);
  const [items, setItems] = useState<Interest[] | null>(null);
  const [q, setQ] = useState(word);
  useEffect(() => {
    store.collections().then(setCols);
    store.interests().then(setItems);
  }, [store]);
  const term = normTitle(q);
  const hit = (s: string) => !term || normTitle(s).includes(term);
  const c = (cols ?? []).filter((x) => hit(x.title + " " + (x.note ?? "")));
  const i = (items ?? []).filter((x) => hit(x.title + " " + x.creator)).slice(0, 30);
  const loaded = cols && items;
  return (
    <Sheet label="Link a word" onClose={onClose}>
      <h2>Link “{word}”</h2>
      <p>Point it at a collection or something you saved. Tapping the word then opens it.</p>
      <input className="input" type="search" placeholder="Search collections and saved things" aria-label="Search collections and saved things" value={q} onChange={(e) => setQ(e.target.value)} />
      {loaded && c.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="small" style={{ fontWeight: 600 }}>Collections</span>
          {c.map((x) => (
            <button key={x.id} className="item-row" onClick={() => onPick("collection", x.id)}>
              <span className="thumb coll-thumb" aria-hidden="true" />
              <span className="grow">
                <strong>{x.title}</strong>
                <span className="sub">Collection</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {loaded && i.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="small" style={{ fontWeight: 600 }}>Saved</span>
          {i.map((x) => (
            <button key={x.id} className="item-row" onClick={() => onPick("interest", x.id)}>
              <Poster src={x.image_url} title={x.title} kind={x.kind} className="thumb" />
              <span className="grow">
                <strong>{x.title}</strong>
                <span className="sub">{details(x)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {loaded && !c.length && !i.length && (
        <span className="muted">
          Nothing matches “{q}”.{" "}
          {term && (
            <button className="link" onClick={() => setQ("")}>
              Show everything
            </button>
          )}
        </span>
      )}
    </Sheet>
  );
}
