"use client";
import { useState } from "react";
import Mascot from "./Mascot";

/** Three opening screens: scattered labels that fall into one line. Shown once, before Welcome. */
const LABELS = [
  { t: "a film that stayed with you", bg: "var(--lilac)" },
  { t: "3 am idea", bg: "var(--butter)" },
  { t: "that quote", bg: "var(--card)" },
  { t: "a saved link", bg: "var(--blue)" },
  { t: "half a thought", bg: "transparent", line: true },
  { t: "a song from that summer", bg: "var(--butter)" },
  { t: "something you heard", bg: "var(--lilac)" },
];
const SCATTER = [
  { x: 6, y: 2, r: -8 },
  { x: 52, y: 15, r: 12 },
  { x: 0, y: 26, r: 6 },
  { x: 38, y: 38, r: -14 },
  { x: 4, y: 51, r: -4 },
  { x: 22, y: 63, r: 9 },
  { x: 6, y: 77, r: -11 },
];
const TIMES = ["Sun 8 Nov", "Mon 9 Nov", "Wed 11 Nov", "Wed 11 Nov", "Fri 13 Nov", "Sat 14 Nov", "Today"];
const COPY = [
  { h: "Your head is full of things worth keeping.", p: "Thoughts, films, lines from books. They turn up out of order and drift off again." },
  { h: "Catch them as they come.", p: "One tap saves a thought. Pin it to the film, book or song that sparked it, and it shows up on that page too." },
  { h: "And watch them fall into line.", p: "Sort them when you feel like it. Come back in a year and see how your thinking has moved." },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const dark = step < 2;
  // step 0: all scattered. step 1: the first three are in line. step 2: all in line.
  const inLine = (i: number) => (step === 0 ? false : step === 1 ? i < 3 : true);
  return (
    <main className={"onb" + (dark ? " onb-dark" : "")}>
      <div className="onb-stage" aria-hidden="true">
        {step > 0 && <span className="onb-line" style={{ height: step === 1 ? "33%" : "100%" }} />}
        {LABELS.map((l, i) => {
          const s = SCATTER[i];
          const lined = inLine(i);
          return (
            <span key={l.t}>
              <span
                className={"onb-label" + (l.line ? " outline" : "")}
                style={{
                  background: l.bg,
                  left: lined ? 46 : `${s.x}%`,
                  top: lined ? `${i * (step === 1 ? 11 : 12.5)}%` : `${s.y}%`,
                  transform: `rotate(${lined ? 0 : s.r}deg)`,
                }}
              >
                {l.t}
              </span>
              {lined && <span className="onb-dot" style={{ top: `calc(${i * (step === 1 ? 11 : 12.5)}% + 13px)`, background: l.bg === "transparent" ? "var(--paper)" : l.bg }} />}
              {lined && <span className="onb-time" style={{ top: `calc(${i * (step === 1 ? 11 : 12.5)}% + 11px)` }}>{step === 1 ? ["3:12 am", "9:40 am", "1:05 pm"][i] : TIMES[i]}</span>}
            </span>
          );
        })}
        <span className="onb-mascot">
          <Mascot size={step === 2 ? 92 : 104} eyes={step === 2 ? "happy" : step === 1 ? "look" : "wide"} mouth={step === 2 ? "smile" : step === 1 ? "o" : "wobble"} tilt={step === 0 ? -8 : 0} line={dark ? "#FBFAF7" : "#151515"} />
        </span>
      </div>
      <div className="stack" style={{ gap: 12 }}>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, letterSpacing: "-0.02em" }}>{COPY[step].h}</h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45, color: dark ? "var(--on-dark)" : "var(--muted)" }}>{COPY[step].p}</p>
        {step === 2 && (
          <div className="card row" style={{ alignItems: "flex-start", gap: 10, padding: "10px 12px" }}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 18px", marginTop: 1 }}>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <span style={{ fontSize: 13, lineHeight: 1.4 }}>
              <strong style={{ fontWeight: 600 }}>Yours, and only yours.</strong> No ads, no AI reading your words. Take everything with you as plain files, any time.
            </span>
          </div>
        )}
      </div>
      <div className="between">
        <div role="img" aria-label={`Step ${step + 1} of 3`} className="row" style={{ gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="onb-pip" style={{ width: i === step ? 28 : 10, opacity: i === step ? 1 : 0.4 }} />
          ))}
        </div>
        <div className="row">
          {step < 2 && (
            <button className="link" style={{ color: "inherit", fontWeight: 500 }} onClick={onDone}>
              Skip
            </button>
          )}
          {step < 2 ? (
            <button className="btn lilac" style={{ minHeight: 52 }} onClick={() => setStep(step + 1)}>
              Next
            </button>
          ) : (
            <button className="btn ink shadow" style={{ minHeight: 52 }} onClick={onDone}>
              Start your line
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
