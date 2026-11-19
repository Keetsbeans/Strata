"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import { stamp } from "@/lib/dates";
import Icon from "@/components/Icon";
import Mascot from "@/components/Mascot";

/** A folder opened: the thoughts you left halfway, as a deck of cards. One at a time. */
export default function Stack() {
  const { store } = useApp();
  const router = useRouter();
  const [i, setI] = useState(0);
  const { data } = useData(async () => (await store.thoughts()).filter((t) => !t.finished), [store]);
  if (!data) return <main className="screen no-nav" />;
  const n = data.length;
  const t = n ? data[i % n] : null;
  const behind = 2; // the deck always looks like a stack, even with one card

  return (
    <main className="screen no-nav stack-screen">
      <header className="between">
        <span className="h-mid" style={{ fontWeight: 600 }}>Unfinished</span>
        <button className="icon-btn round" aria-label="Close" onClick={() => router.back()}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>×</span>
        </button>
      </header>
      {t ? (
        <>
          <div className="stack-deck">
            {Array.from({ length: behind }, (_, k) => (
              <div key={k} className="card stack-behind" aria-hidden="true" style={{ transform: `rotate(${k ? 4 : -3}deg) translateY(${(k + 1) * -8}px)`, background: k ? "var(--butter)" : "var(--lilac)" }} />
            ))}
            <article className="card stack-front" aria-label={`Thought ${(i % n) + 1} of ${n}`}>
              <span className="stack-tag">{stamp(t.created_at)}</span>
              <p className="ruled-text" style={{ margin: 0 }}>{t.body || "Empty so far."}</p>
            </article>
          </div>
          <p className="small muted" style={{ textAlign: "center", margin: 0 }}>{(i % n) + 1} of {n}</p>
          <div className="row">
            <Link className="btn ink shadow grow" href={`/write/?id=${t.id}`}>
              <Icon name="pen" size={16} /> Keep writing
            </Link>
            {n > 1 && (
              <button className="btn grow" onClick={() => setI(i + 1)}>
                Next card
              </button>
            )}
          </div>
          <Link className="link small" href="/thoughts/?filter=unfinished" style={{ textAlign: "center", fontWeight: 500 }}>
            See them as a list
          </Link>
        </>
      ) : (
        <div className="empty">
          <Mascot size={72} />
          <h2>Nothing half-written</h2>
          <p>When you leave a thought unfinished, it waits for you here.</p>
        </div>
      )}
    </main>
  );
}
