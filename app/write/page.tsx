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
  const [wasFinished, setWasFinished] = useState(false);
  const [loaded, setLoaded] = useState(!id);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showTimer, setShowTimer] = useState(false);
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
        setWasFinished(t.finished);
        setLoaded(true);
      });
  }, [id, store]);

  useEffect(() => {
    if (threadId) store.thread(threadId).then((t) => setThreadTitle(t?.title ?? null));
  }, [threadId, store]);

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

  const save = async (finished: boolean) => {
    if (empty) return;
    setBusy(true);
    setError("");
    try {
      const patch = { body: body.trim(), topics, kind, finished, thread_id: threadId };
      const t = id ? await store.updateThought(id, patch) : await store.addThought(patch);
      setOriginal(body);
      if (!finished) router.replace("/");
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
          {id ? (wasFinished ? "Edit thought" : "Unfinished") : kind === "card" ? "New thought" : "Long reflection"}
        </span>
        <button className="btn sm ink" style={{ fontWeight: 600 }} disabled={empty || busy} onClick={() => save(true)}>
          Save
        </button>
      </header>

      <div className="between small muted">
        <span>
          {day(now)} · {time(now)}
        </span>
        {threadTitle && <span className="tag">Thread: {threadTitle}</span>}
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

      <Dictate onText={(t) => setBody((b) => (b && !/\s$/.test(b) ? b + " " : b) + t)} />

      <Topics value={topics} onChange={setTopics} known={known} />

      {kind === "card" && body.length > LONG_AT && (
        <button className="card row" style={{ textAlign: "left", background: "var(--blue)" }} onClick={() => setKind("page")}>
          <span className="grow">This is getting long. Open it as a full page? Nothing is lost.</span>
          <strong>Open</strong>
        </button>
      )}

      {kind === "card" ? (
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
