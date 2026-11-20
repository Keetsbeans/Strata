"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import { day } from "@/lib/dates";
import Nav from "@/components/Nav";
import TopIcons from "@/components/TopIcons";
import Jar from "@/components/Jar";
import Toast from "@/components/Toast";
import Guide from "@/components/Guide";
import Icon from "@/components/Icon";
import type { Thought } from "@/lib/types";

const FIRST = 5;

function JarPage() {
  const { store } = useApp();
  const q = useSearchParams();
  const { data, error } = useData(async () => (await store.thoughts()).filter((t) => t.jar && t.finished && !t.discarded_at), [store]);
  const [open, setOpen] = useState<Thought | null>(null);
  const [note, setNote] = useState("");
  const [all, setAll] = useState(false);
  const api = useRef<{ close: () => void } | null>(null);
  useEffect(() => {
    if (q.get("added")) setNote("In the jar");
  }, [q]);

  if (error) return <main className="screen"><p className="error">{error}</p><Nav /></main>;
  if (!data) return <main className="screen"><Nav /></main>;
  const notes = data;
  const putBack = () => {
    setOpen(null);
    api.current?.close();
  };

  return (
    <>
      <main className="screen" style={{ gap: 16 }}>
        <header className="between" style={{ minHeight: 48 }}>
          <h1 className="h-page">Gratitude jar</h1>
          <TopIcons />
        </header>
        <p className="muted" style={{ margin: "-8px 0 0", fontSize: 14 }}>
          Small things you&apos;re grateful for, kept for whenever you need one.
        </p>
        <div className="jar-wrap" data-tip="jar">
          <Jar notes={notes} api={api} onOpen={setOpen} onEmpty={() => setNote("The jar is empty. Add something you're grateful for.")} />
        </div>
        <p className="small muted" style={{ textAlign: "center", margin: "-4px 0 0" }}>
          {notes.length ? "Tap the jar to shake it · tap the lid to take one out" : "Nothing in here yet"}
        </p>
        <Link className="btn ink block" href="/write/?kind=card&jar=1" data-tip="jar-add">
          <Icon name="plus" size={18} /> Add to the jar
        </Link>

        {notes.length > 0 && (
          <section className="stack" style={{ gap: 8 }} data-tip="jar-list">
            <div className="between">
              <h2 style={{ fontSize: 17 }}>In the jar · {notes.length}</h2>
            </div>
            {(all ? notes : notes.slice(0, FIRST)).map((t) => (
              <Link key={t.id} href={`/thought/?id=${t.id}`} className="jar-row">
                <span className="jar-row-chit" aria-hidden="true" />
                <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                  <span className="serif clamp2" style={{ fontSize: 16, lineHeight: 1.35 }}>{t.body}</span>
                  <span className="small muted">{day(t.created_at, { weekday: false })}</span>
                </span>
              </Link>
            ))}
            {notes.length > FIRST && (
              <button className="link small" style={{ minHeight: 44, alignSelf: "center" }} onClick={() => setAll(!all)}>
                {all ? "Show fewer" : `Show all ${notes.length}`}
              </button>
            )}
          </section>
        )}
      </main>
      <Nav />
      {open && (
        <>
          <div className="scrim fade" onClick={putBack} />
          <div className="dialog jar-card" role="dialog" aria-modal="true" aria-label="A note from the jar">
            <span className="small muted">{day(open.created_at)}</span>
            <p className="serif" style={{ fontSize: 22, lineHeight: 1.35, margin: "4px 0 6px" }}>{open.body}</p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn ink grow" onClick={putBack}>Put it back</button>
              <Link className="btn grow" href={`/thought/?id=${open.id}`}>Open the note</Link>
            </div>
          </div>
        </>
      )}
      {note && <Toast title={note} onDone={() => setNote("")} />}
      <Guide
        id="jar"
        steps={[
          { at: "jar", title: "Your gratitude jar", text: "Each folded note is one thing you were grateful for. Tap the glass and the jar rattles." },
          { at: "jar", title: "Take one out", text: "Tap the yellow lid. It unscrews and one note, picked at random, comes out to remind you." },
          { at: "jar-add", title: "Add to it any time", text: "Write a note here, or tap + anywhere and choose the gratitude jar. Jar notes never need sorting." },
          ...(notes.length ? [{ at: "jar-list", title: "Every note, in one place", text: "All your notes are listed here, newest first. They also show in Thoughts, under All." }] : []),
        ]}
      />
    </>
  );
}

export default function JarScreen() {
  return (
    <Suspense>
      <JarPage />
    </Suspense>
  );
}
