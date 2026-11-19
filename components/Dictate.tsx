"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import Dialog, { Choice } from "./Dialog";
import { getVoiceMode, liveSupported, MODEL_SIZE, onModel, privateSupported, setVoiceMode, toMono16k, transcribe, voiceChosen, warmUp, type VoiceMode } from "@/lib/voice";

const MAX_SECONDS = 300;

type Props = { onText: (text: string) => void; big?: boolean; autoSpeak?: boolean };
type Inner = Props & { autoStart?: boolean; gate: () => boolean };

/**
 * Speak instead of typing. Private (on this phone) by default. The first time someone taps Speak,
 * a pop-up explains both ways so they know what they are agreeing to; Settings can change it later.
 */
export default function Dictate(props: Props) {
  const [mode, setMode] = useState<VoiceMode | "none" | null>(null);
  const [asking, setAsking] = useState(false);
  const [pick, setPick] = useState<VoiceMode>("private");
  const [autoStart, setAutoStart] = useState(false);
  const [can, setCan] = useState({ private: false, live: false });
  useEffect(() => {
    const c = { private: privateSupported(), live: liveSupported() };
    setCan(c);
    const m = getVoiceMode();
    const resolved = m === "live" ? "live" : c.private ? "private" : c.live ? "live" : "none";
    setMode(resolved);
    // opened from the "Speak a thought" shortcut: start listening straight away (or ask first, the first time)
    if (props.autoSpeak && resolved !== "none") {
      if (voiceChosen()) setAutoStart(true);
      else {
        setPick(c.private ? "private" : "live");
        setAsking(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (mode === null) return null;
  if (mode === "none")
    return props.big ? <p className="small muted" style={{ margin: 0 }}>Tip: tap the microphone on your keyboard to speak instead of typing.</p> : null;

  // first tap: explain both ways before anything is switched on
  const gate = () => {
    if (voiceChosen()) return true;
    setPick(can.private ? "private" : "live");
    setAsking(true);
    return false;
  };
  const choose = () => {
    setVoiceMode(pick);
    setAsking(false);
    setAutoStart(true);
    setMode(pick);
  };
  const Inner = mode === "live" ? LiveDictate : PrivateDictate;
  return (
    <>
      <Inner key={mode + String(autoStart)} {...props} gate={gate} autoStart={autoStart} />
      {asking && (
        <Dialog
          title="How should Strata hear you?"
          body="Pick how your voice turns into text. Either way, Strata never keeps the recording."
          face="asking"
          onClose={() => setAsking(false)}
          actions={
            <>
              <button className="btn ink block" onClick={choose}>
                Start speaking
              </button>
              <button className="link" style={{ minHeight: 44 }} onClick={() => setAsking(false)}>
                Not now
              </button>
            </>
          }
        >
          <div role="radiogroup" aria-label="Voice typing" className="stack" style={{ gap: 10 }}>
            {can.private && (
              <Choice
                on={pick === "private"}
                onClick={() => setPick("private")}
                title="On this phone (recommended)"
                sub={`Your voice never leaves the phone. Works offline after a one-time download (${MODEL_SIZE}). Words appear a few seconds after you stop.`}
              />
            )}
            {can.live && (
              <Choice
                on={pick === "live"}
                onClick={() => setPick("live")}
                title="Live, with Google or Apple"
                sub="Words appear while you speak. Google (Android) or Apple (iPhone) hears your voice to turn it into text. Needs internet."
              />
            )}
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            You can change this any time in Settings.
          </p>
        </Dialog>
      )}
    </>
  );
}

function SpeakButton({ listening, big, onClick, disabled }: { listening: boolean; big: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={"btn " + (listening ? "lilac" : "") + (big ? " block speak" : " sm")} aria-pressed={listening} onClick={onClick} disabled={disabled}>
      <Icon name={listening ? "stop" : "mic"} size={big ? 22 : 18} />
      {listening ? "Stop speaking" : big ? "Speak instead of typing" : "Speak"}
    </button>
  );
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
// Whisper writes things like "[BLANK_AUDIO]" or "(music)" when it hears no words
const clean = (t: string) => t.replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();

function PrivateDictate({ onText, big = true, gate, autoStart }: Inner) {
  const [state, setState] = useState<"idle" | "listening" | "working">("idle");
  const [secs, setSecs] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<any>(null);
  const files = useRef<Record<string, { loaded: number; total: number }>>({});

  useEffect(() => {
    const off = onModel((m) => {
      if (m.type === "progress") {
        files.current[m.file] = { loaded: m.loaded, total: m.total };
        const all = Object.values(files.current);
        const total = all.reduce((a, f) => a + f.total, 0);
        setProgress(total ? Math.min(99, Math.round((100 * all.reduce((a, f) => a + f.loaded, 0)) / total)) : null);
      } else if (m.type === "ready") setProgress(null);
      else if (m.type === "error" && m.id === undefined) {
        setProgress(null);
        setError("The private speech model couldn't load. Check your connection and try again. It only downloads once.");
      }
    });
    return () => {
      off();
      clearInterval(timer.current);
      rec.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = async () => {
    if (!gate()) return;
    setError("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError("Strata isn't allowed to use the microphone. Allow it in your browser's site settings, then try again.");
      return;
    }
    warmUp(); // fetch the model while the person talks
    chunks.current = [];
    const r = new MediaRecorder(stream);
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(timer.current);
      setState("working");
      try {
        const audio = await toMono16k(new Blob(chunks.current, { type: r.mimeType }));
        const text = clean(await transcribe(audio));
        if (text) onText(text);
        else setError("I didn't catch any words. Try again a little closer to the phone.");
      } catch {
        setError("The private speech model couldn't load. Check your connection and try again. It only downloads once.");
      }
      setState("idle");
    };
    rec.current = r;
    r.start(1000);
    setSecs(0);
    timer.current = setInterval(
      () =>
        setSecs((s) => {
          if (s + 1 >= MAX_SECONDS && r.state === "recording") r.stop();
          return s + 1;
        }),
      1000
    );
    setState("listening");
  };

  // started straight after the first-time pop-up
  useEffect(() => {
    if (autoStart) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => {
    if (rec.current?.state === "recording") rec.current.stop();
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      <SpeakButton listening={state === "listening"} big={big} onClick={state === "listening" ? stop : start} disabled={state === "working"} />
      {state === "listening" && (
        <p className="small" role="status" style={{ margin: 0, minHeight: 18 }}>
          <span className="listening-dot" aria-hidden="true" /> Listening… {clock(secs)}. Tap Stop when you&apos;re done.
        </p>
      )}
      {state === "working" && (
        <p className="small" role="status" style={{ margin: 0 }}>
          {progress !== null ? `Getting the private speech model ready, ${progress}%…` : "Turning your words into text on this phone…"}
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

type Rec = any;
function getRecognition(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** Live mode (opt-in): the phone's own speech service, Google on Android or Apple on iPhone. */
function LiveDictate({ onText, big = true, gate, autoStart }: Inner) {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [error, setError] = useState("");
  const rec = useRef<Rec>(null);
  const want = useRef(false);

  useEffect(
    () => () => {
      want.current = false;
      rec.current?.abort?.();
    },
    []
  );

  const start = () => {
    const R = getRecognition();
    if (!R || !gate()) return;
    setError("");
    const r = new R();
    r.lang = navigator.language || "en-IN";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) onText(res[0].transcript.trim());
        else interim += res[0].transcript;
      }
      setHeard(interim);
    };
    r.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        want.current = false;
        setError("Strata isn't allowed to use the microphone. Allow it in your browser's site settings, then try again.");
      } else if (e.error === "network") {
        want.current = false;
        setError("Live voice typing needs an internet connection. Turn it off in Settings to use private voice typing instead.");
      }
    };
    // phones stop listening after a pause; keep going until the person taps Stop
    r.onend = () => {
      setHeard("");
      if (want.current) {
        try {
          r.start();
          return;
        } catch {}
      }
      setListening(false);
    };
    rec.current = r;
    want.current = true;
    r.start();
    setListening(true);
  };

  // started straight after the first-time pop-up
  useEffect(() => {
    if (autoStart) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => {
    want.current = false;
    rec.current?.stop?.();
    setListening(false);
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      <SpeakButton listening={listening} big={big} onClick={listening ? stop : start} />
      {listening && (
        <p className="small" role="status" style={{ margin: 0, minHeight: 18 }}>
          <span className="listening-dot" aria-hidden="true" /> Listening… {heard && <span className="serif" style={{ fontSize: 15 }}>{heard}</span>}
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
