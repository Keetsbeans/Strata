"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import type { InterestKind } from "@/lib/types";
import { caption } from "@/lib/interests";
import { KIND_LABEL } from "@/lib/types";
import { getMoods, moodColour, setMoods } from "@/lib/moods";
import { usePictureFill } from "@/lib/catalog/pictures";
import Nav from "@/components/Nav";
import Mascot from "@/components/Mascot";
import Poster from "@/components/Poster";
import Dialog from "@/components/Dialog";

const KINDS: InterestKind[] = ["film", "book", "music", "article"];
const FIRST: Record<InterestKind, string> = {
  film: "Add one you watched, or one you want to. Its poster and details fill in by themselves.",
  book: "Add one you read, or one you want to. Its cover fills in by itself.",
  music: "Add an album or a song. Its cover fills in by itself.",
  article: "Save a link to something you read, or want to. Paste it in Add, or share it from another app.",
};

function Library() {
  const { store } = useApp();
  const router = useRouter();
  const q = useSearchParams();
  const kind = (KINDS.includes(q.get("kind") as InterestKind) ? q.get("kind") : "film") as InterestKind;
  const { data, error, setData } = useData(async () => {
    const [items, thoughts, collections] = await Promise.all([store.interests(), store.thoughts(), store.collections()]);
    const pinned = new Map<string, number>();
    for (const t of thoughts) if (t.interest_id) pinned.set(t.interest_id, (pinned.get(t.interest_id) ?? 0) + 1);
    return { items, pinned, collections: collections.length };
  }, [store]);
  const [moods, setMoodList] = useState<string[]>([]);
  const [mood, setMood] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => setMoodList(getMoods()), []);

  const shown = data?.items.filter((i) => i.kind === kind && (!mood || i.moods.some((m) => m.toLowerCase() === mood.toLowerCase())));
  usePictureFill(store, shown, (it) => setData((d) => d && { ...d, items: d.items.map((x) => (x.id === it.id ? { ...it } : x)) }));

  if (error) return <main className="screen"><p className="error">{error}</p><Nav /></main>;
  const count = (k: InterestKind) => data?.items.filter((i) => i.kind === k).length ?? 0;
  const L = KIND_LABEL[kind];

  return (
    <>
      <main className="screen" style={{ gap: 16 }}>
        <header className="between">
          <h1 className="h-big">Interests</h1>
          <Link className="btn ink shadow" href={`/interests/add/?kind=${kind}`}>
            Add
          </Link>
        </header>
        <div className="chips" role="group" aria-label="Kind">
          {KINDS.map((k) => (
            <button key={k} className="chip" aria-pressed={k === kind} onClick={() => router.replace(`/interests/?kind=${k}`)}>
              {KIND_LABEL[k].many}
              {data && count(k) > 0 && <span className="small" style={{ marginLeft: 6, opacity: 0.75 }}>{count(k)}</span>}
            </button>
          ))}
        </div>
        <div className="folders">
          <Link href="/collections/" className="folder">
            <span>Collections</span>
            <b>{data?.collections ?? ""}</b>
          </Link>
          <Link href="/interests/import/" className="folder">
            <span>Bring your shelf</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
        {data && count(kind) > 0 && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="between">
              <span className="small" style={{ fontWeight: 600 }}>In the mood for</span>
              <button className="link small" style={{ minHeight: 32, fontWeight: 500 }} onClick={() => setEditing(true)}>
                Edit moods
              </button>
            </div>
            <div className="chips" style={{ gap: 6 }}>
              {moods.map((m) => (
                <button key={m} className="mood-chip" aria-pressed={mood === m} onClick={() => setMood(mood === m ? null : m)}>
                  <i style={{ background: moodColour(m) }} />
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}
        {data && shown && shown.length > 0 && (
          <div className="shelf">
            {shown.map((it) => (
              <Link key={it.id} href={`/interest/?id=${it.id}`} className="shelf-item">
                <Poster src={it.image_url} title={it.title} kind={it.kind} />
                <span className="stack" style={{ gap: 2 }}>
                  <strong style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>{it.title}</strong>
                  <span className="small muted">
                    {caption(it, data.pinned.get(it.id) ?? 0)}
                    {it.moods[0] ? ` · ${it.moods[0]}` : ""}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
        {data && shown?.length === 0 && count(kind) > 0 && (
          <div className="empty">
            <h2>Nothing {mood?.toLowerCase()} yet</h2>
            <p>Give an item the mood “{mood}” on its page and it shows up here.</p>
            <button className="btn" onClick={() => setMood(null)}>Show all {L.many.toLowerCase()}</button>
          </div>
        )}
        {data && count(kind) === 0 && (
          <div className="empty">
            <Mascot size={72} />
            <h2>No {L.many.toLowerCase()} yet</h2>
            <p>{FIRST[kind]}</p>
            <Link className="btn ink" style={{ marginTop: 8 }} href={`/interests/add/?kind=${kind}`}>
              Add your first {L.one.toLowerCase()}
            </Link>
            {(kind === "film" || kind === "book") && (
              <Link className="link" href="/interests/import/" style={{ fontWeight: 500 }}>
                Or bring them from {kind === "film" ? "Letterboxd" : "Goodreads"}
              </Link>
            )}
          </div>
        )}
      </main>
      {editing && <MoodEditor moods={moods} onClose={() => setEditing(false)} onSave={(m) => (setMoods(m), setMoodList(m), setEditing(false))} />}
      <Nav />
    </>
  );
}

function MoodEditor({ moods, onSave, onClose }: { moods: string[]; onSave: (m: string[]) => void; onClose: () => void }) {
  const [list, setList] = useState(moods);
  const [name, setName] = useState("");
  return (
    <Dialog
      title="Your moods"
      body="Name the moods you pick things by. Rename one by typing over it."
      onClose={onClose}
      actions={
        <>
          <button className="btn ink block" onClick={() => onSave(list.map((m) => m.trim()).filter(Boolean))}>Save moods</button>
          <button className="btn block" onClick={onClose}>Cancel</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 8 }}>
        {list.map((m, i) => (
          <div key={i} className="row">
            <input className="input" style={{ minHeight: 44 }} value={m} aria-label={`Mood ${i + 1}`} onChange={(e) => setList(list.map((x, j) => (j === i ? e.target.value.slice(0, 24) : x)))} />
            <button className="icon-btn" aria-label={`Remove ${m}`} onClick={() => setList(list.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        {list.length < 12 && (
          <form className="row" onSubmit={(e) => (e.preventDefault(), name.trim() && (setList([...list, name.trim().slice(0, 24)]), setName("")))}>
            <input className="input" style={{ minHeight: 44 }} placeholder="Add a mood, like Funny" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn sm" disabled={!name.trim()}>Add</button>
          </form>
        )}
      </div>
    </Dialog>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Library />
    </Suspense>
  );
}
