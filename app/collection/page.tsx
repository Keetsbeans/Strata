"use client";
import Link from "next/link";
import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import { details } from "@/lib/interests";
import { KIND_LABEL } from "@/lib/types";
import { day } from "@/lib/dates";
import { normTitle } from "@/lib/catalog/match";
import Icon from "@/components/Icon";
import Poster from "@/components/Poster";
import PickUpRow from "@/components/PickUpRow";
import Dialog from "@/components/Dialog";
import { CollectionForm, contents } from "@/components/CollectionBits";
import { preview } from "@/components/ThoughtCard";

function CollectionView() {
  const { store } = useApp();
  const router = useRouter();
  const id = useSearchParams().get("id") || "";
  const { data, error, reload } = useData(async () => {
    const [c, interests, thoughts] = await Promise.all([store.collection(id), store.interests(), store.thoughts()]);
    return { c, interests: new Map(interests.map((i) => [i.id, i])), thoughts: new Map(thoughts.map((t) => [t.id, t])), allInterests: interests, allThoughts: thoughts };
  }, [store, id]);
  const [mode, setMode] = useState<null | "edit" | "add" | "delete">(null);
  const [removing, setRemoving] = useState(false);
  const [q, setQ] = useState("");
  const list = useRef<HTMLDivElement>(null);

  if (error) return <main className="screen no-nav"><p className="error">{error}</p></main>;
  if (!data) return <main className="screen no-nav" />;
  const { c, interests, thoughts } = data;
  if (!c)
    return (
      <main className="screen no-nav">
        <p className="error">This collection isn&apos;t here any more.</p>
        <Link className="btn" href="/collections/">Back to collections</Link>
      </main>
    );

  // thoughts in this collection, plus thoughts pinned to its films, books and songs
  const itemIds = new Set(c.items.map((x) => x.interest_id).filter(Boolean));
  const related = data.allThoughts.filter((t) => t.interest_id && itemIds.has(t.interest_id));
  const entries = c.items.filter((x) => x.interest_id && interests.has(x.interest_id));
  const term = normTitle(q);

  return (
    <main className="screen no-nav">
      <header className="between">
        <button className="icon-btn round" aria-label="Back" onClick={() => router.back()}>
          <Icon name="back" />
        </button>
        <span className="h-mid" style={{ fontWeight: 600 }}>Collection</span>
        <button className="btn sm" onClick={() => setMode("edit")}>Edit</button>
      </header>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="h-title">{c.title}</h1>
        {c.note && <p className="serif" style={{ margin: 0, fontSize: 18, lineHeight: 1.35 }}>{c.note}</p>}
        <span className="small muted">{contents(c.items, interests, thoughts)}</span>
      </div>

      <PickUpRow thoughts={related} min={3} onViewMore={() => list.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />

      <div className="stack" style={{ gap: 10, scrollMarginTop: 20 }} ref={list}>
        {entries.length > 0 && (
          <div className="between">
            <h2 style={{ fontSize: 15 }}>On the shelf</h2>
            <button className="link small" style={{ minHeight: 44 }} onClick={() => setRemoving(!removing)}>
              {removing ? "Done" : "Take things out"}
            </button>
          </div>
        )}
        {entries.map((x) => {
          const it = interests.get(x.interest_id!)!;
          return (
            <div key={x.id} className="row" style={{ gap: 8 }}>
              <Link href={`/interest/?id=${it.id}`} className="item-row grow">
                  <Poster src={it.image_url} title={it.title} kind={it.kind} className="thumb" />
                  <span className="grow">
                    <strong>{it.title}</strong>
                    <span className="sub">
                      {details(it)} · {it.status === "done" ? KIND_LABEL[it.kind].done.toLowerCase() + (it.done_at ? " " + day(it.done_at, { weekday: false }) : "") : KIND_LABEL[it.kind].want.toLowerCase()}
                    </span>
                  </span>
                </Link>
              {removing && (
                <button className="icon-btn" aria-label={`Take ${it.title} out`} onClick={async () => (await store.removeFromCollection(x.id), reload())}>
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
          );
        })}
        {entries.length === 0 && <div className="empty"><h2>An empty shelf</h2><p>Add films, books, songs or links that belong here.</p></div>}
        <button className="btn block dashed" style={{ fontWeight: 500 }} onClick={() => setMode("add")}>
          <Icon name="plus" size={18} /> Add something
        </button>
      </div>

      {mode === "edit" && (
        <CollectionForm
          initial={c}
          onClose={() => setMode(null)}
          onDelete={() => setMode("delete")}
          onSave={async (title, note) => {
            await store.updateCollection(c.id, { title, note });
            setMode(null);
            reload();
          }}
        />
      )}
      {mode === "delete" && (
        <Dialog
          title="Delete this collection?"
          body="Only the shelf goes. The films, books and songs on it stay where they are."
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
            <input className="input" placeholder="Find" aria-label="Find" value={q} onChange={(e) => setQ(e.target.value)} />
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
              {data.allInterests.length === 0 && <span className="muted">Nothing in Interests yet.</span>}
            </div>
            <button className="btn ink block" onClick={() => setMode(null)}>Done</button>
          </div>
        </>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <CollectionView />
    </Suspense>
  );
}
