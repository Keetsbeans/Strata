"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import type { InterestKind } from "@/lib/types";
import { getMoods, setMoods } from "@/lib/moods";
import { normTitle } from "@/lib/catalog/match";
import { CollectionPicker } from "@/components/Pickers";
import { FilterBar, NO_FILTERS, SavedRow, SavedTile, kindWord, matches, type Filters } from "@/components/Saved";
import Icon from "@/components/Icon";
import { usePictureFill } from "@/lib/catalog/pictures";
import Nav from "@/components/Nav";
import Toast from "@/components/Toast";
import Mascot from "@/components/Mascot";
import Dialog from "@/components/Dialog";

const KINDS: InterestKind[] = ["film", "book", "music", "article"];
const FIRST: Record<InterestKind, string> = {
  film: "Add one you watched, or one you want to. Its poster and details fill in by themselves.",
  book: "Add one you read, or one you want to. Its cover fills in by itself.",
  music: "Add an album or a song. Its cover fills in by itself.",
  article: "Save a link to something you read, or want to. Paste it in Add, or share it from another app.",
};

type Quick = "all" | "loose" | "nomood";

function Library() {
  const { store } = useApp();
  const router = useRouter();
  const q = useSearchParams();
  const start = (KINDS.includes(q.get("kind") as InterestKind) ? q.get("kind") : null) as InterestKind | null;
  const { data, error, setData, reload } = useData(async () => {
    const [items, thoughts, collections] = await Promise.all([store.interests(), store.thoughts(), store.collections()]);
    const pinned = new Map<string, number>();
    for (const t of thoughts) if (t.interest_id) pinned.set(t.interest_id, (pinned.get(t.interest_id) ?? 0) + 1);
    const where = new Map<string, string[]>();
    for (const c of collections) for (const x of c.items) if (x.interest_id) where.set(x.interest_id, [...(where.get(x.interest_id) ?? []), c.title]);
    return { items, pinned, where };
  }, [store]);
  const [moods, setMoodList] = useState<string[]>([]);
  const [f, setF] = useState<Filters>({ ...NO_FILTERS, kind: start });
  const [quick, setQuick] = useState<Quick>((q.get("show") as Quick) || "all");
  const [find, setFind] = useState("");
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [toColl, setToColl] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => setMoodList(getMoods()), []);

  const term = normTitle(find);
  const all = data?.items ?? [];
  const loose = all.filter((i) => !data?.where.has(i.id));
  const nomood = all.filter((i) => !i.moods.length);
  const shown = (quick === "loose" ? loose : quick === "nomood" ? nomood : all).filter((i) => matches(i, f) && (!term || normTitle(i.title + " " + i.creator).includes(term)));
  usePictureFill(store, shown, (it) => setData((d) => d && { ...d, items: d.items.map((x) => (x.id === it.id ? { ...it } : x)) }));

  if (error) return <main className="screen"><p className="error">{error}</p><Nav /></main>;
  const selecting = picked !== null;
  const flip = (id: string) => setPicked((p) => (p ? (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]) : p));
  const sub = (it: (typeof all)[number]) => {
    if (quick === "nomood") return `${kindWord(it.kind)} · no mood`;
    const n = data?.pinned.get(it.id) ?? 0;
    return [kindWord(it.kind), it.moods[0], n ? `${n} ${n === 1 ? "thought" : "thoughts"}` : ""].filter(Boolean).join(" · ");
  };
  const flag = (id: string, moodless: boolean) => (quick === "all" ? (!data?.where.has(id) ? "No collection" : moodless ? "No mood" : undefined) : undefined);
  const giveMood = async (m: string) => {
    if (!picked?.length) return;
    for (const id of picked) {
      const it = all.find((x) => x.id === id);
      if (it && !has(it.moods, m)) await store.updateInterest(id, { moods: [...it.moods, m] });
    }
    setNote(`Gave ${picked.length} ${picked.length === 1 ? "thing" : "things"} the mood ${m}.`);
    setPicked(null);
    reload();
  };
  const tiles = shown.filter((i) => i.kind !== "article");
  const rows = shown.filter((i) => i.kind === "article");

  return (
    <>
      <main className="screen" style={{ gap: 18, paddingBottom: selecting ? 220 : undefined }}>
        {selecting ? (
          <header className="between">
            <button className="btn sm" onClick={() => setPicked(null)}>Cancel</button>
            <span className="h-mid" style={{ fontWeight: 600 }} aria-live="polite">{picked.length} selected</span>
            <button className="btn sm" onClick={() => setPicked(shown.map((i) => i.id))}>Select all</button>
          </header>
        ) : (
          <>
            <header className="between">
              <button className="icon-btn round" aria-label="Back to collections" onClick={() => router.push("/collections/")}>
                <Icon name="back" />
              </button>
              <span className="h-mid" style={{ fontWeight: 600 }}>Saved</span>
              <div className="row" style={{ gap: 6 }}>
                {all.length > 0 && <button className="link small" style={{ minHeight: 44, padding: "0 6px" }} onClick={() => (setNote(""), setPicked([]))}>Select</button>}
                <Link className="btn sm" href={`/interests/add/?kind=${f.kind ?? "film"}`}>Add</Link>
              </div>
            </header>
            <div className="stack" style={{ gap: 4 }}>
              <h1 className="h-title">Everything you saved</h1>
              <span className="small muted">{all.length} {all.length === 1 ? "thing" : "things"}, in a collection or not</span>
            </div>
            {all.length > 0 && <input className="input" type="search" placeholder="Find a film, book, song or link" aria-label="Find a film, book, song or link" value={find} onChange={(e) => setFind(e.target.value)} />}
          </>
        )}
        {all.length > 0 && <FilterBar items={all} value={f} onChange={setF} moods={moods} onEditMoods={() => setEditing(true)} />}
        {all.length > 0 && (
          <div className="pills" role="group" aria-label="Show">
            {([["all", "All", all.length], ["loose", "Not in a collection", loose.length], ["nomood", "No mood", nomood.length]] as const).map(([k, label, n]) => (
              <button key={k} className="pill" aria-pressed={quick === k} onClick={() => setQuick(k)}>
                <span>{label} · {n}</span>
              </button>
            ))}
          </div>
        )}
        {selecting && <span className="small muted" style={{ marginTop: -6 }}>Tap things to pick them, then choose what to do below. Filters still work while you select.</span>}
        {note && !selecting && <Toast title={note} onDone={() => setNote("")} />}
        {tiles.length > 0 && (
          <div className="saved-grid">
            {tiles.map((it) => (
              <SavedTile key={it.id} it={it} sub={sub(it)} flag={selecting ? undefined : flag(it.id, !it.moods.length)} picked={picked?.includes(it.id)} onPick={selecting ? () => flip(it.id) : undefined} />
            ))}
          </div>
        )}
        {rows.length > 0 && (
          <div className="stack" style={{ gap: 8 }}>
            {rows.map((it) => (
              <SavedRow key={it.id} it={it} sub={data?.where.get(it.id) ? `Link · in “${data.where.get(it.id)![0]}”` : undefined} picked={picked?.includes(it.id)} onPick={selecting ? () => flip(it.id) : undefined} />
            ))}
          </div>
        )}
        {data && all.length > 0 && shown.length === 0 && (
          <div className="empty">
            <h2>Nothing matches</h2>
            <p>Try another filter, or show everything again.</p>
            <button className="btn sm" onClick={() => (setF(NO_FILTERS), setQuick("all"), setFind(""))}>Show everything</button>
          </div>
        )}
        {data && all.length === 0 && (
          <div className="empty">
            <Mascot size={72} />
            <h2>Nothing saved yet</h2>
            <p>{FIRST.film}</p>
            <Link className="btn ink" style={{ marginTop: 8 }} href="/interests/add/?kind=film">Add your first one</Link>
          </div>
        )}
        {!selecting && data && (
          <Link className="link small" href="/interests/import/" style={{ alignSelf: "center", minHeight: 44, display: "inline-flex", alignItems: "center" }}>
            Bring your shelf from Letterboxd or Goodreads
          </Link>
        )}
      </main>
      {selecting ? (
        <div className="select-bar" role="region" aria-label="Do with the picked things">
          <strong style={{ fontSize: 14 }}>Give them a mood</strong>
          <div className="pills" style={{ margin: "-6px -16px", padding: "0 16px" }}>
            {moods.map((m) => (
              <button key={m} className="pill" disabled={!picked.length} onClick={() => giveMood(m)}>
                <span>{m}</span>
              </button>
            ))}
          </div>
          <button className="btn ink block" style={{ minHeight: 46 }} disabled={!picked.length} onClick={() => setToColl(true)}>
            Add to a collection
          </button>
        </div>
      ) : (
        <Nav />
      )}
      {toColl && picked && (
        <CollectionPicker
          store={store}
          onClose={() => setToColl(false)}
          onPick={async (cid) => {
            for (const id of picked) await store.addToCollection(cid, { interest_id: id });
            const c = await store.collection(cid);
            setToColl(false);
            setNote(`Added ${picked.length} ${picked.length === 1 ? "thing" : "things"} to ${c?.title ?? "the collection"}.`);
            setPicked(null);
            reload();
          }}
        />
      )}
      {editing && <MoodEditor moods={moods} onClose={() => setEditing(false)} onSave={(m) => (setMoods(m), setMoodList(m), setEditing(false))} />}
    </>
  );
}

const has = (list: string[], x: string) => list.some((m) => m.toLowerCase() === x.toLowerCase());

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
