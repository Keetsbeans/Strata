"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import { details } from "@/lib/interests";
import { getMoods } from "@/lib/moods";
import { normTitle } from "@/lib/catalog/match";
import { usePictureFill } from "@/lib/catalog/pictures";
import Icon from "@/components/Icon";
import Poster from "@/components/Poster";
import Dialog from "@/components/Dialog";
import Nav from "@/components/Nav";
import { CollectionForm, contents } from "@/components/CollectionBits";
import { FilterBar, NO_FILTERS, SavedRow, SavedTile, matches, type Filters } from "@/components/Saved";

function CollectionView() {
  const { store } = useApp();
  const router = useRouter();
  const id = useSearchParams().get("id") || "";
  const { data, error, reload, setData } = useData(async () => {
    const [c, interests] = await Promise.all([store.collection(id), store.interests()]);
    return { c, interests: new Map(interests.map((i) => [i.id, i])), allInterests: interests };
  }, [store, id]);
  const [mode, setMode] = useState<null | "edit" | "add" | "delete">(null);
  const [removing, setRemoving] = useState(false);
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [q, setQ] = useState("");
  const [moods] = useState(() => (typeof window === "undefined" ? [] : getMoods()));
  const things = data?.c ? data.c.items.map((x) => ({ x, it: data.interests.get(x.interest_id ?? "") })).filter((e) => !!e.it) : [];
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
        {things.length > 1 && <FilterBar items={things.map((e) => e.it!)} value={f} onChange={setF} moods={moods} />}
        {things.length > 0 && (
          <div className="between" style={{ marginTop: -6 }}>
            <span className="small muted">{filtered ? `${shown.length} of ${things.length}` : `${things.length} ${things.length === 1 ? "thing" : "things"}`}</span>
            <button className="link small" style={{ minHeight: 44 }} onClick={() => setRemoving(!removing)}>
              {removing ? "Done" : "Take things out"}
            </button>
          </div>
        )}
        {shown.some((e) => e.it!.kind !== "article") && (
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
        {shown.some((e) => e.it!.kind === "article") && (
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
        {things.length > 0 && shown.length === 0 && (
          <div className="empty">
            <h2>Nothing matches</h2>
            <button className="btn sm" onClick={() => setF(NO_FILTERS)}>Show all</button>
          </div>
        )}
        {things.length === 0 && (
          <div className="empty">
            <h2>An empty collection</h2>
            <p>Add films, books, songs or links that belong here.</p>
            <button className="btn ink" onClick={() => setMode("add")}>Add something</button>
          </div>
        )}
      </main>
      <Nav />

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
