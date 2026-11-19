"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import { day } from "@/lib/dates";
import { getMoods } from "@/lib/moods";
import { usePictureFill } from "@/lib/catalog/pictures";
import Icon from "@/components/Icon";
import { CollectionPicker } from "@/components/Pickers";
import { FilterBar, NO_FILTERS, SavedTile, matches, type Filters } from "@/components/Saved";

const FROM: Record<string, string> = { letterboxd: "Letterboxd", goodreads: "Goodreads" };

function ImportSort() {
  const { store } = useApp();
  const router = useRouter();
  const id = useSearchParams().get("id") || "";
  const { data, error, reload, setData } = useData(async () => {
    const [imports, items, collections] = await Promise.all([store.imports(), store.interests(), store.collections()]);
    const inColl = new Set(collections.flatMap((c) => c.items.map((x) => x.interest_id)));
    return { batch: imports.find((b) => b.id === id) ?? null, items: items.filter((i) => i.import_id === id), inColl };
  }, [store, id]);
  const [moods, setMoods] = useState<string[]>([]);
  const [noMood, setNoMood] = useState(true);
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [picked, setPicked] = useState<string[]>([]);
  const [toColl, setToColl] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => setMoods(getMoods()), []);
  const items = data?.items ?? [];
  const shown = items.filter((i) => (!noMood || !i.moods.length) && matches(i, f));
  usePictureFill(store, shown, (it) => setData((d) => d && { ...d, items: d.items.map((x) => (x.id === it.id ? { ...it } : x)) }));

  if (error) return <main className="screen no-nav"><p className="error">{error}</p></main>;
  if (!data) return <main className="screen no-nav" />;
  const { batch } = data;
  if (!batch)
    return (
      <main className="screen no-nav">
        <p className="error">This import isn&apos;t here any more.</p>
        <Link className="btn" href="/inbox/">Back to Inbox</Link>
      </main>
    );
  const kind = items[0]?.kind === "book" ? ["book", "books"] : ["film", "films"];
  const left = items.filter((i) => !i.moods.length).length;
  const flip = (x: string) => setPicked((p) => (p.includes(x) ? p.filter((y) => y !== x) : [...p, x]));
  const done = async () => {
    await store.finishImport(batch.id);
    router.push("/inbox/?tab=sort");
  };
  const giveMood = async (m: string) => {
    for (const x of picked) {
      const it = items.find((i) => i.id === x);
      if (it && !it.moods.some((y) => y.toLowerCase() === m.toLowerCase())) await store.updateInterest(x, { moods: [...it.moods, m] });
    }
    setNote(`Gave ${picked.length} the mood ${m}.`);
    setPicked([]);
    reload();
  };

  return (
    <>
      <main className="screen no-nav" style={{ gap: 18, paddingBottom: picked.length ? 220 : undefined }}>
        <header className="between">
          <button className="icon-btn round" aria-label="Back to Inbox" onClick={() => router.push("/inbox/?tab=sort")}>
            <Icon name="back" />
          </button>
          <span className="h-mid" style={{ fontWeight: 600 }}>Your import</span>
          <button className="btn sm" onClick={done}>Done</button>
        </header>
        <div className="stack" style={{ gap: 4 }}>
          <h1 className="h-title">
            {batch.count} {batch.count === 1 ? kind[0] : kind[1]} from {FROM[batch.source] ?? batch.source}
          </h1>
          <span className="small muted">
            Imported {day(batch.created_at)} · {left ? `${left} with no mood yet` : "all have a mood"}
          </span>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
          <button className="pill" aria-pressed={noMood} onClick={() => setNoMood(!noMood)}>
            <span>No mood yet</span>
          </button>
          <FilterBar items={items} value={f} onChange={setF} moods={moods} />
        </div>
        <span className="small muted" style={{ marginTop: -8 }}>
          Tap things to pick them, then give them a mood or add them to a collection. Everything is already saved.
        </span>
        {note && <span className="small muted" role="status">{note}</span>}
        {shown.length > 0 ? (
          <>
            <div className="saved-grid">
              {shown.map((it) => (
                <SavedTile key={it.id} it={it} sub={[it.year, it.moods[0]].filter(Boolean).join(" · ")} picked={picked.includes(it.id)} onPick={() => flip(it.id)} />
              ))}
            </div>
            {picked.length < shown.length && (
              <button className="link small" style={{ alignSelf: "center", minHeight: 44 }} onClick={() => setPicked(shown.map((i) => i.id))}>
                Pick all {shown.length}
              </button>
            )}
          </>
        ) : (
          <div className="empty">
            <h2>{noMood ? "Every one has a mood" : "Nothing matches"}</h2>
            <p>{noMood ? "Nicely sorted. Tap Done to take this off your Inbox." : "Try another filter."}</p>
            {noMood && <button className="btn ink sm" onClick={done}>Done</button>}
          </div>
        )}
      </main>
      {picked.length > 0 && (
        <div className="select-bar" role="region" aria-label="Do with the picked things">
          <div className="between">
            <strong style={{ fontSize: 14 }}>{picked.length} selected</strong>
            <button className="link small" style={{ minHeight: 44 }} onClick={() => setPicked([])}>Clear</button>
          </div>
          <div className="pills" style={{ margin: "-6px -16px", padding: "0 16px" }}>
            {moods.map((m) => (
              <button key={m} className="pill" onClick={() => giveMood(m)}>
                <span>{m}</span>
              </button>
            ))}
          </div>
          <button className="btn ink block" style={{ minHeight: 46 }} onClick={() => setToColl(true)}>
            Add to a collection
          </button>
        </div>
      )}
      {toColl && (
        <CollectionPicker
          store={store}
          onClose={() => setToColl(false)}
          onPick={async (cid) => {
            for (const x of picked) await store.addToCollection(cid, { interest_id: x });
            const c = await store.collection(cid);
            setToColl(false);
            setNote(`Added ${picked.length} to ${c?.title ?? "the collection"}.`);
            setPicked([]);
            reload();
          }}
        />
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ImportSort />
    </Suspense>
  );
}
