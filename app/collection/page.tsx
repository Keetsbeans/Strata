"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import { details } from "@/lib/interests";
import { getMoods } from "@/lib/moods";
import { normTitle } from "@/lib/catalog/match";
import { usePictureFill } from "@/lib/catalog/pictures";
import Icon from "@/components/Icon";
import SlideSeg from "@/components/SlideSeg";
import Poster from "@/components/Poster";
import Dialog from "@/components/Dialog";
import Nav from "@/components/Nav";
import { CollectionForm, contents } from "@/components/CollectionBits";
import Safe from "@/components/Safe";
import Guide from "@/components/Guide";
import { day } from "@/lib/dates";
import Board, { STICKERS } from "@/components/Board";
import type { Decor } from "@/lib/types";
import { FilterBar, NO_FILTERS, SavedRow, SavedTile, matches, type Filters } from "@/components/Saved";

function CollectionView() {
  const { store } = useApp();
  const router = useRouter();
  const id = useSearchParams().get("id") || "";
  const { data, error, reload, setData } = useData(async () => {
    const [c, interests, thoughts] = await Promise.all([store.collection(id), store.interests(), store.thoughts()]);
    return { c, interests: new Map(interests.map((i) => [i.id, i])), allInterests: interests, mine: thoughts.filter((t) => t.collection_id === id && t.finished) };
  }, [store, id]);
  const [mode, setMode] = useState<null | "edit" | "add" | "delete">(null);
  const [removing, setRemoving] = useState(false);
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [q, setQ] = useState("");
  const [moods] = useState(() => (typeof window === "undefined" ? [] : getMoods()));
  const [view, setView] = useState<"tiles" | "board">("tiles");
  const [decor, setDecor] = useState<Decor[]>([]);
  const [drawer, setDrawer] = useState<null | "stickers" | "labels">(null);
  const [label, setLabel] = useState("");
  const center = useRef<() => { x: number; y: number }>(() => ({ x: 200, y: 200 }));
  useEffect(() => {
    try {
      if (localStorage.getItem("strata:view:" + id) === "board") setView("board");
    } catch {}
  }, [id]);
  useEffect(() => setDecor(data?.c?.decor ?? []), [data?.c]);
  const pickView = (v: "tiles" | "board") => {
    setView(v);
    try {
      localStorage.setItem("strata:view:" + id, v);
    } catch {}
  };
  const things = data?.c ? data.c.items.map((x) => ({ x, it: data.interests.get(x.interest_id ?? "") })).filter((e) => !!e.it) : [];
  // the same list object until the data really changes, so the board never resets mid-gesture
  const boardThings = useMemo(
    () => (data?.c ? data.c.items.flatMap((x) => { const it = data.interests.get(x.interest_id ?? ""); return it ? [{ x, it }] : []; }) : []),
    [data],
  );
  usePictureFill(store, things.map((e) => e.it!), (it) => setData((d) => d && { ...d, interests: new Map(d.interests).set(it.id, it) }));

  if (error) return <main className="screen"><p className="error">{error}</p><Nav /></main>;
  if (!data) return <main className="screen"><Nav /></main>;
  const { c, interests } = data;
  if (!c)
    return (
      <main className="screen">
        <p className="error">This collection isn&apos;t here any more.</p>
        <Link className="btn" href="/collections/">Back to collections</Link>
        <Nav />
      </main>
    );

  const used = [...new Set(decor.filter((d) => d.kind === "label").map((d) => d.name))].slice(0, 8);
  const addDecor = async (kind: Decor["kind"], name: string) => {
    const m = center.current();
    const d: Decor = { id: Math.random().toString(36).slice(2, 10), kind, name, x: m.x - (kind === "label" ? 60 : 28) + Math.round(Math.random() * 60 - 30), y: m.y - 28 + Math.round(Math.random() * 60 - 30), r: Math.round(Math.random() * 10 - 5) };
    const next = [...decor, d];
    setDecor(next);
    setDrawer(null);
    await store.updateCollection(c.id, { decor: next });
  };
  const itemIds = new Set(c.items.map((x) => x.interest_id).filter(Boolean));
  const shown = things.filter((e) => matches(e.it!, f));
  const term = normTitle(q);
  const filtered = shown.length !== things.length;
  const sub = (it: NonNullable<(typeof things)[number]["it"]>) => [it.year, it.moods[0]].filter(Boolean).join(" · ") || details(it);

  return (
    <>
      <main className="screen" style={{ gap: 18 }}>
        <header className="between">
          <button className="icon-btn round" aria-label="Back" onClick={() => router.push("/collections/")}>
            <Icon name="back" />
          </button>
          <span className="h-mid" style={{ fontWeight: 600 }}>Collection</span>
          <button className="btn sm" onClick={() => (setQ(""), setMode("add"))}>Add</button>
        </header>
        <div className="stack" style={{ gap: 4 }}>
          <h1 className="h-title">{c.title}</h1>
          {c.note && <p className="serif" style={{ margin: "2px 0 4px", fontSize: 17, lineHeight: 1.35 }}>{c.note}</p>}
          <div className="row" style={{ gap: 6, alignItems: "center" }}>
            <span className="small muted">{contents(c.items, interests)} ·</span>
            <button className="link small" style={{ minHeight: 44, padding: 0 }} onClick={() => setMode("edit")}>
              Edit name, note and cover
            </button>
          </div>
        </div>
        {things.length > 0 && (
          <SlideSeg wide label="How to show it" dep={view}>
            <button aria-pressed={view === "tiles"} onClick={() => pickView("tiles")}>Tiles</button>
            <button aria-pressed={view === "board"} onClick={() => pickView("board")}>Board</button>
          </SlideSeg>
        )}
        {view === "tiles" && things.length > 1 && <FilterBar items={things.map((e) => e.it!)} value={f} onChange={setF} moods={moods} />}
        {view === "tiles" && things.length > 0 && (
          <div className="between" style={{ marginTop: -6 }}>
            <span className="small muted">{filtered ? `${shown.length} of ${things.length}` : `${things.length} ${things.length === 1 ? "thing" : "things"}`}</span>
            <button className="link small" style={{ minHeight: 44 }} onClick={() => setRemoving(!removing)}>
              {removing ? "Done" : "Take things out"}
            </button>
          </div>
        )}
        {view === "tiles" && shown.some((e) => e.it!.kind !== "article") && (
          <div className="saved-grid two">
            {shown
              .filter((e) => e.it!.kind !== "article")
              .map(({ x, it }) =>
                removing ? (
                  <button key={x.id} className="saved-tile" aria-label={`Take ${it!.title} out`} onClick={async () => (await store.removeFromCollection(x.id), reload())}>
                    <span style={{ position: "relative", display: "block" }}>
                      <Poster src={it!.image_url} title={it!.title} kind={it!.kind} />
                      <span className="box" style={{ background: "var(--card)" }}><Icon name="close" size={13} /></span>
                    </span>
                    <strong>{it!.title}</strong>
                    <span className="sub">Tap to take it out</span>
                  </button>
                ) : (
                  <SavedTile key={x.id} it={it!} sub={sub(it!)} />
                ),
              )}
          </div>
        )}
        {view === "tiles" && shown.some((e) => e.it!.kind === "article") && (
          <div className="stack" style={{ gap: 8 }}>
            {shown
              .filter((e) => e.it!.kind === "article")
              .map(({ x, it }) =>
                removing ? (
                  <button key={x.id} className="item-row" aria-label={`Take ${it!.title} out`} onClick={async () => (await store.removeFromCollection(x.id), reload())}>
                    <Poster src={it!.image_url} title={it!.title} kind={it!.kind} className="thumb" />
                    <span className="grow"><strong>{it!.title}</strong><span className="sub">Tap to take it out</span></span>
                    <Icon name="close" size={16} />
                  </button>
                ) : (
                  <SavedRow key={x.id} it={it!} />
                ),
              )}
          </div>
        )}
        {view === "tiles" && things.length > 0 && shown.length === 0 && (
          <div className="empty">
            <h2>Nothing matches</h2>
            <button className="btn sm" onClick={() => setF(NO_FILTERS)}>Show all</button>
          </div>
        )}
        {view === "tiles" && data.mine.length > 0 && (
          <section className="stack" style={{ gap: 8 }}>
            <h2 style={{ fontSize: 15 }}>Your thoughts</h2>
            {data.mine.map((t) => (
              <Link key={t.id} href={`/thought/?id=${t.id}`} className="card" style={{ textDecoration: "none", padding: "12px 16px" }}>
                <span className="small muted">{day(t.created_at, { weekday: false })}</span>
                <p className="serif clamp2" style={{ margin: "2px 0 0", fontSize: 16, lineHeight: 1.35 }}>{t.body}</p>
              </Link>
            ))}
          </section>
        )}
        {things.length === 0 && (
          <div className="empty">
            <h2>An empty collection</h2>
            <p>Add films, books, songs or links that belong here.</p>
            <button className="btn ink" onClick={() => setMode("add")}>Add something</button>
          </div>
        )}
      </main>
      {view === "board" && things.length > 0 && (
        <div className="board-screen" role="dialog" aria-label={`${c.title}, as a board`}>
          <header className="board-head">
            <button className="icon-btn round" aria-label="Back to tiles" data-tip="board-back" onClick={() => pickView("tiles")}>
              <Icon name="back" />
            </button>
            <strong className="board-title">{c.title}</strong>
            <button className="btn sm" onClick={() => (setQ(""), setMode("add"))}>Add</button>
          </header>
          <Safe label="board" onReset={reload}>
            <Board
              store={store}
              collectionId={c.id}
              things={boardThings}
              decor={decor}
              onDecor={setDecor}
              center={center}
              tools={
                <>
                  <button onClick={() => setDrawer("stickers")}>Stickers</button>
                  <button onClick={() => setDrawer("labels")}>Label</button>
                </>
              }
            />
          </Safe>
          <Guide
            id="board"
            steps={[
              { at: "board", title: "Your board", text: "Drag with one finger to look around, and pinch to zoom in or out. The board has edges, so nothing gets lost." },
              { at: "board", title: "Move things around", text: "Press and hold a poster or sticker until it lifts, then drag it where you like. Tap a poster to open it." },
              { at: "board-tools", title: "Decorate it", text: "Stickers and Label add little extras. Tidy up puts everything back in neat rows." },
              { at: "board-undo", title: "Undo and redo", text: "Changed your mind? Step back or forward through your last moves." },
              { at: "board-back", title: "Back to tiles", text: "This arrow takes you back to the plain grid. The board remembers where you put everything." },
            ]}
          />
        </div>
      )}
      {view !== "board" && <Nav />}

      {drawer && (
        <>
          <div className="scrim" onClick={() => setDrawer(null)} />
          <div className="dialog" role="dialog" aria-modal="true" aria-label="Stickers and labels">
            <SlideSeg wide label="Stickers or labels" dep={drawer}>
              <button aria-pressed={drawer === "stickers"} onClick={() => setDrawer("stickers")}>Stickers</button>
              <button aria-pressed={drawer === "labels"} onClick={() => setDrawer("labels")}>Labels</button>
            </SlideSeg>
            {drawer === "stickers" ? (
              <>
                <div className="sticker-grid">
                  {Object.entries(STICKERS).map(([name, st]) => (
                    <button key={name} aria-label={`Add ${st.label.toLowerCase()}`} onClick={() => addDecor("sticker", name)}>
                      <svg viewBox="0 0 40 40" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{st.svg}</svg>
                    </button>
                  ))}
                </div>
                <p className="small">Tap a sticker to drop it in the middle of what you can see, then long-press and drag it where you like.</p>
              </>
            ) : (
              <>
                <form className="row" onSubmit={(e) => (e.preventDefault(), label.trim() && (addDecor("label", label.trim().slice(0, 40)), setLabel("")))}>
                  <input className="input" placeholder="Write a few words" aria-label="Label text" value={label} onChange={(e) => setLabel(e.target.value)} />
                  <button className="btn sm ink" disabled={!label.trim()}>Add</button>
                </form>
                {used.length > 0 && (
                  <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                    {used.map((n) => (
                      <button key={n} className="label-chip" onClick={() => addDecor("label", n)}><span>{n}</span></button>
                    ))}
                  </div>
                )}
              </>
            )}
            <button className="link" style={{ fontWeight: 500 }} onClick={() => setDrawer(null)}>Close</button>
          </div>
        </>
      )}
      {mode === "edit" && (
        <CollectionForm
          initial={c}
          covers={things.map((e) => e.it!)}
          onClose={() => setMode(null)}
          onDelete={() => setMode("delete")}
          onSave={async (title, note, cover_id) => {
            await store.updateCollection(c.id, { title, note, cover_id });
            setMode(null);
            reload();
          }}
        />
      )}
      {mode === "delete" && (
        <Dialog
          title="Delete this collection?"
          body="Only the collection goes. The films, books and songs in it stay in Everything you saved."
          face="worried"
          onClose={() => setMode(null)}
          actions={
            <>
              <button className="btn ink block" onClick={async () => (await store.deleteCollection(c.id), router.replace("/collections/"))}>Delete collection</button>
              <button className="btn block" onClick={() => setMode(null)}>Keep it</button>
            </>
          }
        />
      )}
      {mode === "add" && (
        <>
          <div className="scrim" onClick={() => setMode(null)} />
          <div className="dialog" role="dialog" aria-modal="true" aria-label="Add to this collection" style={{ maxHeight: "84dvh", overflowY: "auto" }}>
            <h2>Add to {c.title}</h2>
            <input className="input" placeholder="Find something you saved" aria-label="Find" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="stack" style={{ gap: 8 }}>
              {data.allInterests
                .filter((i) => !itemIds.has(i.id) && (!term || normTitle(i.title).includes(term)))
                .slice(0, 40)
                .map((i) => (
                  <button key={i.id} className="item-row" onClick={async () => (await store.addToCollection(c.id, { interest_id: i.id }), reload())}>
                    <Poster src={i.image_url} title={i.title} kind={i.kind} className="thumb" />
                    <span className="grow">
                      <strong>{i.title}</strong>
                      <span className="sub">{details(i)}</span>
                    </span>
                    <Icon name="plus" size={18} />
                  </button>
                ))}
              {data.allInterests.length === 0 && <span className="muted">Nothing saved yet.</span>}
            </div>
            <Link className="link small" href="/interests/add/?kind=film" style={{ alignSelf: "center", minHeight: 44, display: "inline-flex", alignItems: "center" }}>Save something new first</Link>
            <button className="btn ink block" onClick={() => setMode(null)}>Done</button>
          </div>
        </>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <CollectionView />
    </Suspense>
  );
}
