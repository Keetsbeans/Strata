"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Rec = any;
function getRecognition(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const NOTE_SEEN = "strata:voice-note-seen";

/**
 * Speak instead of typing. Uses the phone's own speech service (Google on Android, Apple on iPhone),
 * which turns the voice into text. Strata itself never keeps any audio.
 */
export default function Dictate({ onText, big = true }: { onText: (text: string) => void; big?: boolean }) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState(false);
  const rec = useRef<Rec>(null);
  const want = useRef(false);

  useEffect(() => {
    setSupported(Boolean(getRecognition()));
    return () => {
      want.current = false;
      rec.current?.abort?.();
    };
  }, []);

  const start = () => {
    const R = getRecognition();
    if (!R) return;
    try {
      if (!localStorage.getItem(NOTE_SEEN)) {
        localStorage.setItem(NOTE_SEEN, "1");
        setNote(true);
      }
    } catch {}
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
        setError("Speaking needs an internet connection.");
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

  const stop = () => {
    want.current = false;
    rec.current?.stop?.();
    setListening(false);
  };

  if (!supported)
    return big ? <p className="small muted" style={{ margin: 0 }}>Tip: tap the microphone on your keyboard to speak instead of typing.</p> : null;

  return (
    <div className="stack" style={{ gap: 8 }}>
      <button
        type="button"
        className={"btn " + (listening ? "lilac" : "") + (big ? " block speak" : " sm")}
        aria-pressed={listening}
        onClick={listening ? stop : start}
      >
        <Icon name={listening ? "stop" : "mic"} size={big ? 22 : 18} />
        {listening ? "Stop speaking" : big ? "Speak instead of typing" : "Speak"}
      </button>
      {listening && (
        <p className="small" role="status" style={{ margin: 0, minHeight: 18 }}>
          <span className="listening-dot" aria-hidden="true" /> Listening… {heard && <span className="serif" style={{ fontSize: 15 }}>{heard}</span>}
        </p>
      )}
      {note && (
        <p className="small muted" style={{ margin: 0 }}>
          Your phone&apos;s own speech service turns your voice into text. Strata never keeps the recording.
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
