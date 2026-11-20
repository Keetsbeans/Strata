"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import Nav from "@/components/Nav";
import Icon from "@/components/Icon";
import Toast from "@/components/Toast";
import Dialog from "@/components/Dialog";
import { CapsuleArt, CapsuleLine, longDay } from "@/components/Capsule";
import { inWords, isReady, openOnDate, openWithKey, progress, whatsInside } from "@/lib/capsule";
import type { CapsuleInside } from "@/lib/types";

function CapsulePage() {
  const { store } = useApp();
  const router = useRouter();
  const q = useSearchParams();
  const id = q.get("id") ?? "";
  const { data: got, error, reload } = useData(async () => ({ c: await store.capsule(id) }), [store, id]);
  const c = got?.c;
  const [inside, setInside] = useState<CapsuleInside | null>(null);
  const [fresh, setFresh] = useState(false); // just opened: play the reveal
  const [asking, setAsking] = useState(false);
  const [key, setKey] = useState("");
  const [keyErr, setKeyErr] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [note, setNote] = useState<{ title: string; line?: string } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (q.get("sealed") && c) setNote({ title: "Sealed", line: `See you on ${longDay(c.open_at)}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, c?.id]);
  // already opened before: show what was inside straight away
  useEffect(() => {
    if (c?.opened_at && !inside) openOnDate(c).then(setInside, (e) => setErr(String(e?.message ?? e)));
  }, [c, inside]);

  if (error) return <main className="screen"><p className="error">{error}</p><Nav /></main>;
  if (got && !c) {
    return (
      <main className="screen">
        <div className="empty"><h2>No capsule here</h2><p>It may have been deleted.</p><Link className="btn ink" href="/capsules/">All capsules</Link></div>
        <Nav />
      </main>
    );
  }
  if (!c) return <main className="screen"><Nav /></main>;

  const ready = isReady(c);
  const state = c.opened_at ? "opened" : ready ? "ready" : "sealed";
  const p = progress(c);

  const open = async () => {
    try {
      const got = await openOnDate(c);
      await store.markCapsuleOpened(c.id, false);
      setFresh(true);
      setInside(got);
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  const openEarly = async () => {
    setKeyErr("");
    try {
      const got = await openWithKey(c, key);
      await store.markCapsuleOpened(c.id, true);
      setAsking(false);
      setFresh(true);
      setInside(got);
      reload();
    } catch (e) {
      setKeyErr(e instanceof Error ? e.message : String(e));
    }
  };
  const keepLetter = async () => {
    if (!inside?.letter) return;
    const t = await store.addThought({ body: inside.letter, kind: "page", finished: true });
    setNote({ title: "Kept in Thoughts", line: "The letter is now a thought of its own" });
    return t;
  };
  const remove = async () => {
    await store.deleteCapsule(c.id);
    router.replace("/capsules/");
  };

  return (
    <>
      <main className="screen" style={{ gap: 18 }}>
        <header className="between">
          <button className="icon-btn round" aria-label="Back" onClick={() => (q.get("sealed") ? router.replace("/capsules/") : router.back())}>
            <Icon name="back" />
          </button>
          <h1 className="h-mid">Time capsule</h1>
          <span style={{ width: 44 }} aria-hidden="true" />
        </header>

        <section className={"cap-hero " + state + (fresh ? " fresh" : "")}>
          <CapsuleArt c={c} size={96} state={state} />
          <h2 className="cap-name">{c.title || "Untitled capsule"}</h2>
          <span className="small muted">
            Sealed {longDay(c.created_at)} · {c.seal === "strict" ? "Strict seal" : "Spare key"}
          </span>
          <span className="small muted">{whatsInside(c)}</span>
        </section>

        {state === "sealed" && (
          <>
            <section className="card stack cap-wait" style={{ gap: 14 }}>
              <div className="between" style={{ alignItems: "flex-end" }}>
                <span className="stack" style={{ gap: 0 }}>
                  <strong className="cap-big">{p.daysLeft}</strong>
                  <span className="small muted">{p.daysLeft === 1 ? "day to go" : "days to go"}</span>
                </span>
                <span className="stack" style={{ gap: 0, textAlign: "right" }}>
                  <strong className="cap-big muted-strong">{p.daysIn}</strong>
                  <span className="small muted">{p.daysIn === 1 ? "day passed" : "days passed"}</span>
                </span>
              </div>
              <CapsuleLine c={c} />
              <span className="cap-next small">
                <strong>Next stop:</strong> {p.passedHalf ? `opening day, ${longDay(c.open_at)} (${inWords(p.daysLeft)})` : `halfway, on ${longDay(p.half)}`}
              </span>
            </section>
            {c.seal === "key" ? (
              <button className="btn block" onClick={() => setAsking(true)}>
                <Icon name="key" size={18} /> Open early with my key
              </button>
            ) : (
              <p className="small muted" style={{ textAlign: "center", margin: 0 }}>Strict seal: nothing opens it before its day.</p>
            )}
            <p className="small muted" style={{ textAlign: "center", margin: "-6px 0 0" }}>
              Scrambled and sealed on this phone until the day.
            </p>
          </>
        )}

        {state === "ready" && (
          <section className="stack" style={{ gap: 12, alignItems: "center", textAlign: "center" }}>
            <h2 style={{ fontSize: 24 }}>It&apos;s the day</h2>
            <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.5, maxWidth: 300 }}>
              You sealed this {p.daysIn} {p.daysIn === 1 ? "day" : "days"} ago, on {longDay(c.created_at)}. Ready to see what you said?
            </p>
            <button className="btn ink block" onClick={open}>Open it</button>
          </section>
        )}

        {inside && (
          <section className={"stack cap-inside" + (fresh ? " fresh" : "")} style={{ gap: 14 }}>
            {c.opened_early && <span className="small muted" style={{ textAlign: "center" }}>Opened early with the spare key, {longDay(c.opened_at ?? new Date())}</span>}
            {inside.letter && (
              <article className="cap-letter-card">
                <span className="small muted">From you, {longDay(c.created_at)}</span>
                <p className="serif">{inside.letter}</p>
                <button className="link small" style={{ alignSelf: "flex-start" }} onClick={keepLetter}>Keep the letter in Thoughts</button>
              </article>
            )}
            {inside.thoughts.length > 0 && (
              <>
                <h2 style={{ fontSize: 17 }}>Thoughts you tucked in · {inside.thoughts.length}</h2>
                {inside.thoughts.map((t, k) => (
                  <article key={k} className="card cap-thought" style={{ animationDelay: fresh ? `${0.5 + k * 0.12}s` : undefined }}>
                    <span className="small muted">Written {longDay(t.created_at)}</span>
                    <p className="serif">{t.body}</p>
                  </article>
                ))}
              </>
            )}
          </section>
        )}
        {err && <p className="error">{err}</p>}

        <button className="link small danger-link" style={{ alignSelf: "center" }} onClick={() => setDeleting(true)}>
          Delete this capsule
        </button>
      </main>
      <Nav />

      {asking && (
        <Dialog
          title="Open it early?"
          face="thinking"
          body={`It's meant to open on ${longDay(c.open_at)}. Type the spare key you saved when you sealed it.`}
          onClose={() => (setAsking(false), setKey(""), setKeyErr(""))}
          actions={
            <>
              <button className="btn ink block" disabled={key.replace(/[^a-z0-9]/gi, "").length < 20} onClick={openEarly}>Open it now</button>
              <button className="btn block" onClick={() => (setAsking(false), setKey(""), setKeyErr(""))}>Keep waiting</button>
            </>
          }
        >
          <input className="input cap-key-input" value={key} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" aria-label="Spare key" onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === "Enter" && openEarly()} />
          {keyErr && <span className="small" style={{ color: "#b3261e" }}>{keyErr}</span>}
        </Dialog>
      )}
      {deleting && (
        <Dialog
          title="Delete this capsule?"
          face="worried"
          body={state === "opened" ? "The capsule goes for good. Thoughts you tucked in are still in Thoughts unless you discarded them." : "It goes for good, with everything inside, unread. This can't be undone."}
          onClose={() => setDeleting(false)}
          actions={
            <>
              <button className="btn danger-fill block" onClick={remove}>Delete for good</button>
              <button className="btn block" onClick={() => setDeleting(false)}>Keep it</button>
            </>
          }
        />
      )}
      {note && <Toast title={note.title} line={note.line} onDone={() => setNote(null)} />}
    </>
  );
}

export default function CapsuleScreen() {
  return (
    <Suspense>
      <CapsulePage />
    </Suspense>
  );
}
