"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Thought } from "@/lib/types";
import type { Store } from "@/lib/store/types";
import { stamp } from "@/lib/dates";
import Icon from "./Icon";
import Topics from "./Topics";
import Mascot from "./Mascot";
import Buddy from "./Buddy";
import SwipeCard from "./SwipeCard";
import { preview } from "./ThoughtCard";
import { tipSeen } from "@/lib/tips";
import Toast from "./Toast";

/**
 * Thoughts as a deck of cards, one at a time.
 * Swipe right to keep, left to discard, up to leave it unsorted for now.
 * The pin puts the card in a thread.
 */
export default function ThoughtDeck({
  store,
  pile,
  known,
  onDiscard,
  onPin,
  threadName,
  emptyText,
}: {
  store: Store;
  pile: Thought[];
  known: string[];
  onDiscard: (t: Thought) => void;
  onPin: (t: Thought) => void;
  threadName: (t: Thought) => string | undefined;
  emptyText: string;
}) {
  const [done, setDone] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [lean, setLean] = useState(0);
  // the first time someone flips through, show what each direction does
  const [guide, setGuide] = useState(false);
  // it waits until the page's own tips are done, so two overlays never stack
  useEffect(() => {
    const check = () => {
      try {
        if (!localStorage.getItem("strata:swipe-guide") && tipSeen("thoughts")) setGuide(true);
      } catch {}
    };
    check();
    window.addEventListener("strata:tip-done", check);
    return () => window.removeEventListener("strata:tip-done", check);
  }, []);
  const doneGuide = () => {
    setGuide(false);
    try {
      localStorage.setItem("strata:swipe-guide", "1");
    } catch {}
  };
  const left = pile.filter((x) => !done.includes(x.id));
  const t = left[0];
  const next = left[1];
  const step = () => setDone((d) => [...d, t.id]);
  useEffect(() => setTopics(t?.topics ?? []), [t]);

  // a short line after Not sure; after Keep, a pop-up offers a thread for 5 seconds, without forcing one
  const [flash, setFlash] = useState("");
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(""), 2600);
    return () => clearTimeout(id);
  }, [flash]);
  const [kept, setKept] = useState<Thought | null>(null);
  const keptToast = kept && (
    <Toast
      title="Kept, and sorted"
      line={`“${preview(kept.body, 40)}”`}
      action={{ label: "Add to a thread", onClick: () => onPin(kept) }}
      onDone={() => setKept(null)}
    />
  );
  const keep = async () => {
    await store.updateThought(t.id, topics.length ? { topics, kept: true } : { kept: true });
    setKept(t);
    step();
  };
  const discard = async () => {
    setKept(null);
    await store.discardThoughts([t.id]);
    onDiscard(t);
    step();
  };
  const later = () => (setFlash("Left in Unsorted for later."), step());

  if (!t)
    return (
      <div className="empty">
        <Mascot size={72} eyes="happy" mouth="smile" arms="up" />
        <h2>{done.length ? "That's the pile" : "No cards here"}</h2>
        <p>{done.length ? "Kept ones stay in your thoughts. Discarded ones wait 30 days. The ones you swiped up are still in Unsorted." : emptyText}</p>
        {done.length > 0 && (
          <button className="btn sm" onClick={() => setDone([])}>
            Go through them again
          </button>
        )}
        {keptToast}
      </div>
    );

  const th = threadName(t);
  return (
    <div className="stack" style={{ gap: 14 }}>
      {keptToast}
      {guide && (
        <div className="guide-layer" role="dialog" aria-modal="true" aria-label="How flipping works" onClick={doneGuide}>
          <div className="guide-box" onClick={(e) => e.stopPropagation()}>
            <strong className="guide-title">Flip through your thoughts</strong>
            <span className="small muted" style={{ textAlign: "center" }}>Push each card one of three ways.</span>
            <div className="guide-stage">
              <span className="sg sg-up"><Icon name="swipe-up" size={18} /><b>Not sure</b><small>Leave it unsorted for later</small></span>
              <span className="sg sg-left"><Icon name="swipe-left" size={18} /><b>Discard</b><small>Waits 30 days, then goes</small></span>
              <span className="sg sg-right"><Icon name="swipe-right" size={18} /><b>Keep</b><small>Stays in your thoughts</small></span>
              <span className="guide-card" aria-hidden="true">
                <i /><i /><i />
              </span>
            </div>
            <button className="btn sm ink" style={{ minWidth: 140 }} onClick={doneGuide} autoFocus>Got it</button>
          </div>
        </div>
      )}
      <div className="deck">
        {next && (
          <div className="card deck-back" aria-hidden="true">
            <span className="small muted">{stamp(next.created_at)}</span>
            <strong>{preview(next.body, 30)}</strong>
          </div>
        )}
        <Buddy lean={lean} />
        <SwipeCard key={t.id} className="card deck-front" label="Thought card" onRight={keep} onLeft={discard} onUp={later} rightHint="Keep" leftHint="Discard" upHint="Not sure" onLean={setLean}>
          <div className="between" style={{ alignItems: "flex-start" }}>
            <span className="stack" style={{ gap: 2 }}>
              <span className="small muted">{stamp(t.created_at)}</span>
              {th && <span className="small">In “{th}”</span>}
            </span>
            <button data-tip="pin" className={"pin-btn" + (t.thread_id ? " on" : "")} style={{ position: "static", margin: "-10px -10px 0 0" }} aria-label={t.thread_id ? "Add it to another thread" : "Add to a thread"} onClick={() => onPin(t)}>
              <i><Icon name="pin" size={15} width={2} /></i>
            </button>
          </div>
          <p className="ruled-text" style={{ margin: "6px 0 16px", flexGrow: 1 }}>{t.body}</p>
          <Topics value={topics} onChange={setTopics} known={known} />
          <Link href={`/thought/?id=${t.id}`} className="link small" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", marginTop: 4 }}>
            Open this thought
          </Link>
        </SwipeCard>
      </div>
      <p className="small muted swipe-help" role="status">
        {flash ? (
          <span className="swipe-flash">{flash}</span>
        ) : (
          <>
            {pile.length - left.length + 1} of {pile.length} ·{" "}
            <button className="link small" onClick={() => setGuide(true)}>How does this work?</button>
          </>
        )}
      </p>
      <div className="review-actions" data-tip="deck">
        <button className="btn sm act no" onClick={discard}><Icon name="swipe-left" size={17} />Discard</button>
        <button className="btn sm act maybe" onClick={later} aria-label="Not sure, leave it unsorted"><Icon name="swipe-up" size={17} />Not sure</button>
        <button className="btn sm act yes" onClick={keep}><Icon name="swipe-right" size={17} />Keep</button>
      </div>
    </div>
  );
}
