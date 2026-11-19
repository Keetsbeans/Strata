"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import type { Interest } from "@/lib/types";
import Nav from "@/components/Nav";
import Mascot from "@/components/Mascot";
import Poster from "@/components/Poster";
import { CollectionForm, contents } from "@/components/CollectionBits";
import Icon from "@/components/Icon";

export default function Collections() {
  const { store } = useApp();
  const router = useRouter();
  const { data, error } = useData(async () => {
    const [cols, interests, thoughts] = await Promise.all([store.collections(), store.interests(), store.thoughts()]);
    return { cols, interests: new Map(interests.map((i) => [i.id, i])), thoughts: new Map(thoughts.map((t) => [t.id, t])) };
  }, [store]);
  const [making, setMaking] = useState(false);

  return (
    <>
      <main className="screen">
        <header className="between">
          <div className="row">
            <button className="icon-btn round" aria-label="Back" onClick={() => router.push("/interests/")}>
              <Icon name="back" />
            </button>
            <h1 className="h-big">Collections</h1>
          </div>
          <button className="btn ink shadow" onClick={() => setMaking(true)}>New</button>
        </header>
        <p className="muted" style={{ margin: 0, fontSize: 15 }}>Things that belong together: films, books, music and your thoughts on them.</p>
        {error && <p className="error">{error}</p>}
        {data?.cols.map((c) => {
          const pics = c.items.map((x) => (x.interest_id ? data.interests.get(x.interest_id) : null)).filter(Boolean).slice(0, 6) as Interest[];
          return (
            <Link key={c.id} href={`/collection/?id=${c.id}`} className="card coll-card">
              <span className="stack" style={{ gap: 2 }}>
                <strong style={{ fontSize: 17, fontWeight: 600 }}>{c.title}</strong>
                <span className="small muted">{contents(c.items, data.interests, data.thoughts)}</span>
              </span>
              {pics.length > 0 && (
                <span className="coll-strip" aria-hidden="true">
                  {pics.map((i) => (
                    <Poster key={i.id} src={i.image_url} title={i.title} kind={i.kind} />
                  ))}
                </span>
              )}
            </Link>
          );
        })}
        {data?.cols.length === 0 && (
          <div className="empty">
            <Mascot size={72} />
            <h2>No collections yet</h2>
            <p>Gather films, books, songs and thoughts that belong together, like “For a rainy Sunday”.</p>
            <button className="btn ink" style={{ marginTop: 8 }} onClick={() => setMaking(true)}>Start a collection</button>
          </div>
        )}
      </main>
      {making && <CollectionForm onClose={() => setMaking(false)} onSave={async (title, note) => {
        const c = await store.addCollection(title, note);
        router.push(`/collection/?id=${c.id}`);
      }} />}
      <Nav />
    </>
  );
}

