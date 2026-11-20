"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import Nav from "@/components/Nav";
import Mascot from "@/components/Mascot";
import Icon from "@/components/Icon";
import TopIcons from "@/components/TopIcons";
import Guide from "@/components/Guide";
import BoardCover from "@/components/BoardCover";
import { CollectionForm, contents } from "@/components/CollectionBits";

export default function Collections() {
  const { store } = useApp();
  const router = useRouter();
  const { data, error } = useData(async () => {
    const [cols, interests] = await Promise.all([store.collections(), store.interests()]);
    const inside = new Set(cols.flatMap((c) => c.items.map((x) => x.interest_id)));
    return { cols, interests: new Map(interests.map((i) => [i.id, i])), total: interests.length, loose: interests.filter((i) => !inside.has(i.id)).length };
  }, [store]);
  const [making, setMaking] = useState(false);

  return (
    <>
      <main className="screen" style={{ gap: 18 }}>
        <header className="between">
          <h1 className="h-page">Collections</h1>
          <span className="row" style={{ gap: 2 }}>
            <TopIcons />
            <button className="new-pill" onClick={() => setMaking(true)} aria-label="New collection" data-tip="new-col">
              <span><Icon name="plus" size={15} width={2.4} /> New</span>
            </button>
          </span>
        </header>
        <p className="muted" style={{ margin: "-6px 0 0", fontSize: 14 }}>Films, books, music and links you like, kept together. Your thoughts stay in Thoughts.</p>
        {error && <p className="error">{error}</p>}
        {data && (
          <Link href="/interests/" className="card saved-bar" data-tip="saved">
            <span className="grow stack" style={{ gap: 2 }}>
              <strong style={{ fontWeight: 600, fontSize: 15 }}>Everything you saved</strong>
              <span className="small muted">
                {data.total} {data.total === 1 ? "thing" : "things"}
                {data.loose ? ` · ${data.loose} not in a collection yet` : ""}
              </span>
            </span>
            <span aria-hidden="true" style={{ display: "inline-flex", transform: "rotate(180deg)" }}><Icon name="back" size={18} /></span>
          </Link>
        )}
        {data && (
          <Link href="/interests/import/" className="row small" style={{ gap: 8, alignItems: "center", minHeight: 44, marginTop: -8, fontWeight: 600 }}>
            <Icon name="download" size={16} /> Import from Letterboxd or Goodreads
          </Link>
        )}
        {data && data.cols.length > 0 && (
          <div className="boards" data-tip="boards">
            {data.cols.map((c) => (
              <Link key={c.id} href={`/collection/?id=${c.id}`} className="board-card">
                <BoardCover c={c} interests={data.interests} />
                <strong>{c.title}</strong>
                <span className="small muted" style={{ marginTop: -4 }}>{contents(c.items, data.interests)}</span>
              </Link>
            ))}
            <button className="board-card" onClick={() => setMaking(true)}>
              <span className="board-cover new">
                <Icon name="plus" size={20} />
                New collection
              </span>
            </button>
          </div>
        )}
        {data?.cols.length === 0 && (
          <div className="empty">
            <Mascot size={72} />
            <h2>No collections yet</h2>
            <p>Gather films, books, songs and links that belong together, like “For a rainy Sunday”.</p>
            <button className="btn ink" style={{ marginTop: 8 }} onClick={() => setMaking(true)}>Start a collection</button>
          </div>
        )}
      </main>
      {data && (
        <Guide
          id="collections"
          steps={[
            { at: "saved", title: "Everything you saved", text: "Every film, book, song and link you've saved, whether or not it's in a collection." },
            data.cols.length
              ? { at: "boards", title: "Collections are boards", text: "Group things that belong together. Open one to see it as tiles, or as a board you can arrange and decorate." }
              : { at: "new-col", title: "Make a collection", text: "Group things that belong together, like “For a rainy Sunday”." },
          ]}
        />
      )}
      {making && (
        <CollectionForm
          onClose={() => setMaking(false)}
          onSave={async (title, note) => {
            const c = await store.addCollection(title, note);
            router.push(`/collection/?id=${c.id}`);
          }}
        />
      )}
      <Nav />
    </>
  );
}
