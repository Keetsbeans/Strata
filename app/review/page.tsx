"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../providers";
import type { Thought } from "@/lib/types";
import { stamp } from "@/lib/dates";
import Icon from "@/components/Icon";
import Topics from "@/components/Topics";
import Mascot from "@/components/Mascot";
import { preview } from "@/components/ThoughtCard";

/** Flip through: one unsorted thought at a time. Keep it, skip it, or discard it. */
export default function Review() {
  const { store } = useApp();
  const router = useRouter();
  const [pile, setPile] = useState<Thought[] | null>(null);
  const [i, setI] = useState(0);
  const [known, setKnown] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);

  useEffect(() => {
    store.thoughts().then((all) => {
      setKnown([...new Set(all.flatMap((t) => t.topics))].sort());
      setPile(all.filter((t) => t.finished && !t.topics.length && !t.kept));
    });
  }, [store]);
  useEffect(() => setTopics([]), [i]);

  if (!pile) return <main className="screen no-nav" />;
  const t = pile[i];
  const next = pile[i + 1];

  const keep = async () => {
    await store.updateThought(t.id, topics.length ? { topics } : { kept: true });
    setI(i + 1);
  };
  const discard = async () => {
    await store.discardThoughts([t.id]);
    setI(i + 1);
  };

  return (
    <main className="screen no-nav">
      <header className="between">
        <button className="icon-btn round" aria-label="Back" onClick={() => router.back()}>
          <Icon name="back" />
        </button>
        <span className="h-mid" style={{ fontWeight: 600 }}>Flip through</span>
        <span className="small muted" style={{ minWidth: 48, textAlign: "right" }}>
          {t ? `${i + 1} / ${pile.length}` : ""}
        </span>
      </header>
      {t ? (
        <>
          <div className="deck">
            {next && (
              <div className="card deck-back" aria-hidden="true">
                <span className="small muted">{stamp(next.created_at)}</span>
                <strong>{preview(next.body, 30)}</strong>
              </div>
            )}
            <article className="card deck-front">
              <span className="small muted">{stamp(t.created_at)}</span>
              <p className="ruled-text" style={{ margin: "10px 0 16px", flexGrow: 1 }}>{t.body}</p>
              <Topics value={topics} onChange={setTopics} known={known} />
            </article>
          </div>
          <div className="review-actions">
            <button className="btn" onClick={discard}>Discard</button>
            <button className="btn" onClick={() => setI(i + 1)} aria-label="Not sure, decide later">Not sure</button>
            <button className="btn ink shadow" onClick={keep}>Keep</button>
          </div>
        </>
      ) : (
        <div className="empty">
          <Mascot size={72} eyes="happy" mouth="smile" arms="up" />
          <h2>{pile.length ? "That's the pile" : "Nothing to flip through"}</h2>
          <p>{pile.length ? "Everything you kept is in your thoughts. Discarded ones wait 30 days." : "Thoughts without a topic gather here so you can look back over them."}</p>
          <Link className="btn ink" href="/thoughts/" style={{ marginTop: 8 }}>
            Back to thoughts
          </Link>
        </div>
      )}
    </main>
  );
}
