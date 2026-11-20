"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import type { ThoughtKind } from "@/lib/types";
import { day, time } from "@/lib/dates";
import Icon from "@/components/Icon";
import Dialog from "@/components/Dialog";
import Topics from "@/components/Topics";
import Dictate from "@/components/Dictate";
import { Dial, MinuteWheel, fmt, useTimer } from "@/components/Timer";
import { isGuest, setGuest, holdPending } from "@/lib/guest";
import { cloudReady } from "@/lib/supabase";

const LONG_AT = 320; // characters before a card suggests opening as a page

function Write() {
  const { store } = useApp();
  const router = useRouter();
  const q = useSearchParams();
  const id = q.get("id");
  const threadParam = q.get("thread");
  const [kind, setKind] = useState<ThoughtKind>(q.get("kind") === "page" ? "page" : "card");
  const [body, setBody] = useState("");
  const [original, setOriginal] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [known, setKnown] = useState<string[]>([]);
  const [threadTitle, setThreadTitle] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(threadParam);
  const [interestId, setInterestId] = useState<string | null>(q.get("interest"));
  const [interestTitle, setInterestTitle] = useState<string | null>(null);
  const [jar, setJar] = useState(q.get("jar") === "1");
  const [wasFinished, setWasFinished] = useState(false);
  const [loaded, setLoaded] = useState(!id);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showTimer, setShowTimer] = useState(false);
  const [askAccount, setAskAccount] = useState<boolean | null>(null);
  const [now] = useState(() => new Date());
  const timer = useTimer(5);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    store.thoughts().then((all) => setKnown([...new Set(all.flatMap((t) => t.topics))].sort()));
    if (id)
      store.thought(id).then((t) => {
        if (!t) return setError("That thought no longer exists.");
        setBody(t.body);
        setOriginal(t.body);
        setTopics(t.topics);
        setKind(t.kind);
        setThreadId(t.thread_id);
        setInterestId(t.interest_id ?? null);
        setJar(!!t.jar);
        setWasFinished(t.finished);
        setLoaded(true);
      });
  }, [id, store]);

  useEffect(() => {
    if (threadId) store.thread(threadId).then((t) => setThreadTitle(t?.title ?? null));
  }, [threadId, store]);
  useEffect(() => {
    if (interestId) store.interest(interestId).then((t) => setInterestTitle(t?.title ?? null));
  }, [interestId, store]);

  // grow the card's writing area with the text
  useEffect(() => {
    const el = area.current;
    if (el && kind === "card") {
      el.style.height = "auto";
      el.style.height = Math.max(34 * 4, el.scrollHeight) + "px";
    }
  }, [body, kind, loaded]);

  const dirty = body.trim() !== original.trim();
  const empty = !body.trim();

  const save = async (finished: boolean, keepHere = false) => {
    if (empty) return;
    // someone straight from the opening screens: offer an account before the first save
    if (!id && !keepHere && isGuest()) return setLeaving(false), setAskAccount(finished);
    if (keepHere) setGuest(false);
    setBusy(true);
    setError("");
    try {
      const patch = { body: body.trim(), topics, kind, finished, thread_id: threadId, interest_id: interestId, jar };
      const t = id ? await store.updateThought(id, patch) : await store.addThought(patch);
      setOriginal(body);
      if (!finished) router.replace("/");
      else if (jar && !id) router.replace("/jar/?added=1");
      else if (interestId && !id) router.replace(`/interest/?id=${interestId}`);
      else if (threadId && !id) router.replace(`/thread/?id=${threadId}`);
      else router.replace(`/thought/?id=${t.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const back = () => (dirty && !empty ? setLeaving(true) : router.back());
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  if (!loaded) return <main className="screen no-nav">{error && <p className="error">{error}</p>}</main>;

  return (
    <main className={"screen no-nav write " + kind}>
      <header className="between">
        <button className="icon-btn round" aria-label="Back" onClick={back}>
          <Icon name="back" />
        </button>
        <span className="h-mid" style={{ fontWeight: 600 }}>
          {id ? (wasFinished ? "Edit thought" : "Unfinished") : jar ? "For the jar" : kind === "card" ? "New thought" : "Long reflection"}
        </span>
        <button className="btn sm ink" style={{ fontWeight: 600 }} disabled={empty || busy} onClick={() => save(true)}>
          Save
        </button>
      </header>

      <div className="between small muted">
        <span>
          {day(now)} · {time(now)}
        </span>
        <span className="row" style={{ gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {interestTitle && <span className="tag lilac">About: {interestTitle}</span>}
          {threadTitle && <span className="tag">Thread: {threadTitle}</span>}
        </span>
      </div>

      <div className={kind === "card" ? "card write-card" : "write-page"}>
        <textarea
          ref={area}
          className={"ruled" + (kind === "page" ? " long" : "")}
          placeholder={kind === "card" ? "What's on your mind?" : "Take your time. Write as much as you please."}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          autoFocus={!id}
          aria-label="Your thought"
        />
      </div>

      <Dictate autoSpeak={q.get("speak") === "1"} onText={(t) => setBody((b) => (b && !/\s$/.test(b) ? b + " " : b) + t)} />

      <Topics value={topics} onChange={setTopics} known={known} />

      <button type="button" className={"jar-toggle" + (jar ? " on" : "")} role="switch" aria-checked={jar} onClick={() => setJar(!jar)}>
        <span className="jar-mini" aria-hidden="true"><i /></span>
        <span className="stack grow" style={{ gap: 1, textAlign: "left" }}>
          <strong>Put it in the gratitude jar</strong>
          <span className="small muted">{jar ? "It goes in the jar. No thread or topic needed." : "Something you're grateful for? Keep it in the jar."}</span>
        </span>
        <span className="switch" aria-hidden="true"><span /></span>
      </button>

      {kind === "card" && body.length > LONG_AT && (
        <button className="card row" style={{ textAlign: "left", background: "var(--blue)" }} onClick={() => setKind("page")}>
          <span className="grow">This is getting long. Open it as a full page? Nothing is lost.</span>
          <strong>Open</strong>
        </button>
      )}

      {kind === "card" && !showTimer && !timer.started ? (
        <button className="timer-offer" onClick={() => setShowTimer(true)}>
          <span className="timer-offer-ic"><Icon name="clock" size={18} /></span>
          <span className="stack grow" style={{ gap: 1, textAlign: "left" }}>
            <strong>Set a timer</strong>
            <span className="small muted">Getting distracted? Give yourself a few minutes to finish this thought.</span>
          </span>
        </button>
      ) : kind === "card" ? (
        <section className="card timer-card">
          <div className="row" style={{ gap: 16 }}>
            <Dial left={timer.left} total={timer.minutes * 60000} size={104} />
            <div className="stack grow" style={{ gap: 6 }}>
              <span className="small muted">{timer.done ? "Time's up" : "Time left"}</span>
              <strong style={{ fontSize: 30, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{timer.done ? "Finish your line" : fmt(timer.left)}</strong>
              <div className="row">
                {!timer.done && (
                  <button className="btn sm ink" onClick={timer.toggle}>
                    {timer.running ? "Pause" : timer.started ? "Resume" : "Start clock"}
                  </button>
                )}
                {timer.started && (
                  <button className="btn sm" onClick={timer.reset}>
                    Reset
                  </button>
                )}
                {!timer.started && (
                  <button className="btn sm" onClick={() => setShowTimer(false)}>
                    Hide
                  </button>
                )}
              </div>
            </div>
          </div>
          {!timer.started && (
            <div className="stack" style={{ gap: 4 }}>
              <span className="small">
                <strong>Minutes.</strong> <span className="muted">Slide to set. Your phone ticks at each step.</span>
              </span>
              <MinuteWheel value={timer.minutes} onChange={timer.setMinutes} />
            </div>
          )}
        </section>
      ) : (
        <div className="between small muted">
          <span>{words} {words === 1 ? "word" : "words"}</span>
          {showTimer || timer.started ? (
            <span className="row">
              {!timer.started && <MinuteWheelSmall value={timer.minutes} onChange={timer.setMinutes} />}
              <button className="btn sm" onClick={timer.toggle}>
                {timer.done ? "Time's up" : timer.running ? fmt(timer.left) + " left" : timer.started ? "Resume " + fmt(timer.left) : "Start " + timer.minutes + " min"}
              </button>
            </span>
          ) : (
            <button className="link" style={{ fontWeight: 500 }} onClick={() => setShowTimer(true)}>
              <Icon name="clock" size={16} /> Set a timer
            </button>
          )}
        </div>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <div className="stack" style={{ gap: 8 }}>
        {kind === "card" && (
          <button className="btn block" onClick={() => setKind("page")}>
            Open as a full page
          </button>
        )}
        {(!id || !wasFinished) && (
          <button className="link" style={{ fontWeight: 500 }} disabled={empty || busy} onClick={() => save(false)}>
            Leave it unfinished
          </button>
        )}
      </div>

      {askAccount !== null && (
        <Dialog
          title={cloudReady ? "Create an account to keep this" : "Keep this on your phone for now"}
          body={
            cloudReady
              ? "An account keeps your thoughts safe if you lose your phone, and on every device you use. Your thought comes with you."
              : "Accounts are being switched on soon. Until then, everything you write stays on this phone, and only you can see it."
          }
          face="asking"
          onClose={() => setAskAccount(null)}
          actions={
            <>
              {cloudReady && (
                <button
                  className="btn ink block shadow"
                  onClick={() => {
                    holdPending({ body: body.trim(), topics, kind, finished: askAccount, thread_id: threadId, interest_id: interestId ?? null, jar });
                    setGuest(false);
                    try {
                      localStorage.removeItem("strata:mode");
                    } catch {}
                    window.location.assign((process.env.NEXT_PUBLIC_BASE_PATH || "") + "/signin/?new=1");
                  }}
                >
                  Create an account
                </button>
              )}
              <button className={cloudReady ? "link" : "btn ink block"} style={cloudReady ? { fontWeight: 500 } : undefined} onClick={() => save(askAccount, true)}>
                {cloudReady ? "Keep it on this phone for now" : "Save it on this phone"}
              </button>
            </>
          }
        />
      )}

      {leaving && (
        <Dialog
          title="Leave without saving?"
          body={wasFinished ? "Your changes to this thought are not saved yet." : "This thought is not saved yet. You can keep it as unfinished and come back to it from Home."}
          face="asking"
          onClose={() => setLeaving(false)}
          actions={
            <>
              {wasFinished ? (
                <button className="btn ink block" onClick={() => save(true)}>
                  Save changes
                </button>
              ) : (
                <button className="btn ink block" onClick={() => save(false)}>
                  Save as unfinished
                </button>
              )}
              <button className="btn block" onClick={() => router.back()}>
                {wasFinished ? "Throw the changes away" : "Throw it away"}
              </button>
              <button className="link" style={{ fontWeight: 500 }} onClick={() => setLeaving(false)}>
                Keep writing
              </button>
            </>
          }
        />
      )}
    </main>
  );
}

function MinuteWheelSmall({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  return (
    <select className="btn sm" value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label="Minutes">
      {[5, 10, 15, 20, 30, 45, 60].map((m) => (
        <option key={m} value={m}>
          {m} min
        </option>
      ))}
    </select>
  );
}

export default function WritePage() {
  return (
    <Suspense>
      <Write />
    </Suspense>
  );
}
