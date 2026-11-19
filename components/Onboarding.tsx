"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Mascot from "./Mascot";

/**
 * Three opening screens. Labels fall onto the mascot (push them around), float (swipe up to put them in line),
 * then sit in one line (tap the mascot). Movement is skipped for people who ask for less of it.
 */
const LABELS = [
  { t: "a film that stayed with you", bg: "var(--lilac)" },
  { t: "3 am idea", bg: "var(--butter)" },
  { t: "that quote", bg: "var(--card)" },
  { t: "a saved link", bg: "var(--blue)" },
  { t: "half a thought", bg: "transparent", line: true },
  { t: "a song from that summer", bg: "var(--butter)" },
  { t: "something you heard", bg: "var(--lilac)" },
];
// where things sit on screen 2 when not in line yet (share of the stage), and their resting tilt
const FLOAT = [
  { x: 0, y: 0, r: 0 },
  { x: 0, y: 0, r: 0 },
  { x: 0, y: 0, r: 0 },
  { x: 0.04, y: 0.42, r: -10 },
  { x: 0.4, y: 0.52, r: 8 },
  { x: 0.02, y: 0.66, r: 5 },
  { x: 0.3, y: 0.8, r: -7 },
];
const DROP_X = [0.05, 0.42, 0.12, 0.5, 0.02, 0.3, 0.18];
const TIMES = ["Sun 8 Nov", "Mon 9 Nov", "Wed 11 Nov", "Wed 11 Nov", "Fri 13 Nov", "Sat 14 Nov", "Today"];
const COPY = [
  { h: "Your head is full of things worth keeping.", p: "Thoughts, films, lines from books. They turn up out of order and drift off again." },
  { h: "Catch them as they come.", p: "One tap saves a thought. Pin it to the film, book or song that sparked it, and it shows up on that page too." },
  { h: "And watch them fall into line.", p: "Sort them when you feel like it. Come back in a year and see how your thinking has moved." },
];
const MASCOT = 104;

type Body = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; on: boolean };

function calm() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export default function Onboarding({ onDone }: { onDone: () => void }) {
  // 0: falling pile. 1: three in line, the rest floating. 1.5: flying into line. 2: all in line.
  const [step, setStep] = useState<0 | 1 | 1.5 | 2>(0);
  const [size, setSize] = useState({ w: 340, h: 380 });
  const [rattled, setRattled] = useState(false);
  const [popping, setPopping] = useState(false);
  const [glow, setGlow] = useState(0);
  const [tapped, setTapped] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLSpanElement | null)[]>([]);
  const mascot = useRef<HTMLSpanElement>(null);
  const bodies = useRef<Body[]>([]);
  const pointer = useRef<{ x: number; y: number; t: number } | null>(null);
  const swipe = useRef<number | null>(null);
  const rattleTimer = useRef<number | undefined>(undefined);
  const dark = step < 2;
  const page = step === 2 ? 2 : step >= 1 ? 1 : 0;

  // measure the stage
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const nudge = useCallback((strength = 1) => {
    const m = mascot.current;
    setRattled(true);
    window.clearTimeout(rattleTimer.current);
    rattleTimer.current = window.setTimeout(() => setRattled(false), 900);
    if (!m || calm() || !m.animate) return;
    const a = 5 * Math.min(1.6, strength);
    m.animate(
      [
        { transform: "translate(0,0) rotate(0deg)" },
        { transform: `translate(${-a}px,1px) rotate(${-a}deg)` },
        { transform: `translate(${a * 0.8}px,0) rotate(${a * 0.7}deg)` },
        { transform: `translate(${-a * 0.4}px,0) rotate(${-a * 0.3}deg)` },
        { transform: "translate(0,0) rotate(0deg)" },
      ],
      { duration: 420, easing: "ease-out" },
    );
  }, []);

  // screen 1: labels drop in, pile up on the floor and on the mascot, and get pushed by a finger
  useEffect(() => {
    if (step !== 0) return;
    const st = stage.current;
    if (!st) return;
    const W = st.clientWidth;
    const H = st.clientHeight;
    const still = calm();
    const mBox = { x: W - MASCOT, y: H - MASCOT + 10, w: MASCOT, h: MASCOT - 10 };
    bodies.current = LABELS.map((_, i) => {
      const el = els.current[i];
      const w = el?.offsetWidth || 120;
      const h = el?.offsetHeight || 40;
      const x = Math.min(W - w, DROP_X[i] * W);
      return { x, y: still ? H - h - (i % 3) * (h + 4) - (i > 2 ? 0 : 0) : -h - i * 70, vx: 0, vy: 0, r: (i % 2 ? 1 : -1) * (6 + i * 2), vr: 0, w, h, on: still };
    });
    const born = performance.now();
    let raf = 0;
    let lastHit = 0;
    const tick = (now: number) => {
      const B = bodies.current;
      B.forEach((b, i) => {
        if (!b.on && now - born > 380 * i + 250) b.on = true;
        if (!b.on) return;
        b.vy += 0.55;
        b.vx *= 0.96;
        b.vr *= 0.9;
        b.x += b.vx;
        b.y += b.vy;
        b.r += b.vr;
        if (b.r > 18) b.r = 18;
        if (b.r < -18) b.r = -18;
        // floor and walls
        if (b.y + b.h > H) {
          b.y = H - b.h;
          if (b.vy > 2) b.vr += (Math.random() - 0.5) * 2;
          b.vy *= -0.3;
          b.vx *= 0.85;
        }
        if (b.x < 0) (b.x = 0), (b.vx = Math.abs(b.vx) * 0.5);
        if (b.x + b.w > W) (b.x = W - b.w), (b.vx = -Math.abs(b.vx) * 0.5);
        if (b.y < -b.h * 3) b.y = -b.h * 3;
        // the mascot is solid: things land on it and it flinches
        const ox = Math.min(b.x + b.w, mBox.x + mBox.w) - Math.max(b.x, mBox.x);
        const oy = Math.min(b.y + b.h, mBox.y + mBox.h) - Math.max(b.y, mBox.y);
        if (ox > 0 && oy > 0) {
          const speed = Math.hypot(b.vx, b.vy);
          if (oy < ox) {
            b.y = b.y < mBox.y ? mBox.y - b.h : mBox.y + mBox.h;
            b.vy *= -0.35;
            b.vx += b.x + b.w / 2 < mBox.x + mBox.w / 2 ? -0.6 : 0.6; // slides off the head
          } else {
            b.x = b.x < mBox.x ? mBox.x - b.w : mBox.x + mBox.w;
            b.vx *= -0.4;
          }
          if (speed > 2.5 && now - lastHit > 260) {
            lastHit = now;
            nudge(speed / 6);
          }
        }
      });
      // labels push each other apart
      for (let i = 0; i < B.length; i++)
        for (let j = i + 1; j < B.length; j++) {
          const a = B[i];
          const c = B[j];
          if (!a.on || !c.on) continue;
          const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
          const oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
          if (ox <= 0 || oy <= 0) continue;
          if (oy < ox) {
            const top = a.y < c.y ? a : c;
            const bot = top === a ? c : a;
            top.y -= oy;
            if (top.vy > 0) top.vy *= -0.2;
            top.vx += (top.x + top.w / 2 < bot.x + bot.w / 2 ? -0.25 : 0.25);
          } else {
            const left = a.x < c.x ? a : c;
            const right = left === a ? c : a;
            left.x -= ox / 2;
            right.x += ox / 2;
            left.vx -= 0.3;
            right.vx += 0.3;
          }
        }
      B.forEach((b, i) => {
        const el = els.current[i];
        if (el) el.style.transform = `translate(${b.x}px, ${b.y}px) rotate(${b.r}deg)`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, nudge]);

  // a finger moving through the pile
  function onMove(e: React.PointerEvent) {
    const st = stage.current;
    if (!st) return;
    const rect = st.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const prev = pointer.current;
    pointer.current = { x, y, t: e.timeStamp };
    if (step !== 0 || !prev || (e.pointerType !== "mouse" && e.buttons === 0) || (e.pointerType === "mouse" && e.buttons === 0 && e.type !== "pointermove")) return;
    const dx = x - prev.x;
    const dy = y - prev.y;
    const W = st.clientWidth;
    const H = st.clientHeight;
    bodies.current.forEach((b) => {
      if (!b.on) return;
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const d = Math.hypot(x - cx, y - cy);
      if (d > 26) return;
      const away = Math.sign(b.x + b.w / 2 - x) || 1;
      b.vx += dx * 0.45 + away * 1.2;
      b.vy += dy * 0.45 - 2.2;
      b.vr += dx * 0.12;
    });
    // brushing past the mascot bothers it too
    if (x > W - MASCOT && y > H - MASCOT && Math.hypot(dx, dy) > 4) nudge(0.6);
  }

  // screen 2: swipe up anywhere to put everything in line
  const organise = useCallback(() => {
    if (step !== 1) return;
    setStep(1.5);
    window.setTimeout(() => setStep(2), calm() ? 200 : 1300);
  }, [step]);
  function onDown(e: React.PointerEvent) {
    swipe.current = e.clientY;
    onMove(e);
  }
  function onUp(e: React.PointerEvent) {
    if (swipe.current != null && swipe.current - e.clientY > 50) organise();
    swipe.current = null;
    pointer.current = null;
  }
  useEffect(() => {
    if (step !== 1) return;
    const onKey = (e: KeyboardEvent) => e.key === "ArrowUp" && organise();
    const onWheel = (e: WheelEvent) => e.deltaY > 30 && organise();
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel);
    return () => (window.removeEventListener("keydown", onKey), window.removeEventListener("wheel", onWheel));
  }, [step, organise]);

  // screen 3: tap the mascot
  function poke() {
    setTapped(true);
    setPopping(false);
    setGlow((g) => g + 1);
    requestAnimationFrame(() => setPopping(true));
    window.setTimeout(() => setPopping(false), 1500);
  }

  const row = Math.min(48, Math.max(38, size.h / 8));
  const inLine = (i: number) => (step === 0 ? false : step === 1 ? i < 3 : true);
  const lineH = step === 0 ? 0 : step === 1 ? row * 2 + 20 : row * 6 + 20;
  const place = (i: number) => {
    if (inLine(i)) return { x: 46, y: i * row, r: 0 };
    const f = FLOAT[i];
    return { x: f.x * size.w, y: f.y * size.h, r: f.r };
  };
  const loose = step === 0 ? 1 : step === 1 ? 0.5 : 0;
  const face =
    popping ? { eyes: "happy" as const, mouth: "grin" as const, arms: "up" as const }
    : step === 0 ? { eyes: "wide" as const, mouth: "wobble" as const, arms: rattled ? ("out" as const) : ("down" as const) }
    : step === 1 ? { eyes: rattled ? ("wide" as const) : ("look" as const), mouth: "o" as const, arms: "down" as const }
    : step === 1.5 ? { eyes: "wide" as const, mouth: "o" as const, arms: "up" as const }
    : { eyes: "happy" as const, mouth: "smile" as const, arms: "down" as const };

  return (
    <main className={"onb" + (dark ? " onb-dark" : "")} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div className={"onb-stage" + (step === 0 ? " pile" : "")} ref={stage}>
        <span className="onb-line" aria-hidden="true" style={{ height: lineH, opacity: step === 0 ? 0 : 1 }} />
        {LABELS.map((l, i) => {
          const p = place(i);
          const lined = inLine(i);
          return (
            <span key={l.t} aria-hidden="true">
              <span
                ref={(el) => {
                  els.current[i] = el;
                }}
                className={"onb-pos" + (step === 0 ? "" : " flow")}
                style={step === 0 ? undefined : { transform: `translate(${p.x}px, ${p.y}px) rotate(${p.r}deg)`, transitionDelay: step === 1.5 ? `${(i - 3) * 90}ms` : undefined }}
              >
                <span
                  key={step === 2 ? `g${glow}` : "s"}
                  className={"onb-label" + (l.line ? " outline" : "") + (!lined && step === 1 ? " float" : "") + (step === 2 && glow ? " glow" : "")}
                  style={{ background: l.bg, animationDelay: !lined && step === 1 ? `${i * -0.7}s` : step === 2 ? `${i * 110}ms` : undefined }}
                >
                  {l.t}
                </span>
              </span>
              {lined && step !== 1.5 && (
                <span key={`d${glow}`} className={"onb-dot" + (glow ? " glow" : "")} style={{ top: i * row + 13, background: l.bg === "transparent" ? "var(--paper)" : l.bg, animationDelay: `${i * 110}ms` }} />
              )}
              {lined && step !== 1.5 && (
                <span className="onb-time" style={{ top: i * row + 11 }}>
                  {step === 1 ? ["3:12 am", "9:40 am", "1:05 pm"][i] : TIMES[i]}
                </span>
              )}
            </span>
          );
        })}
        <span className="onb-mascot" ref={mascot}>
          {step === 2 ? (
            <button type="button" className="onb-poke" onClick={poke} aria-label="Give the mascot a poke">
              <Mascot size={92} {...face} loose={0} className={popping ? "pop" : undefined} line="#151515" />
              {!tapped && <span className="onb-psst">tap me</span>}
            </button>
          ) : (
            <Mascot size={MASCOT} {...face} loose={loose} tilt={step === 0 ? -8 : 0} line="#FBFAF7" />
          )}
        </span>
      </div>
      <div className="stack" style={{ gap: 12 }}>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, letterSpacing: "-0.02em" }}>{COPY[page].h}</h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45, color: dark ? "var(--on-dark)" : "var(--muted)" }}>{COPY[page].p}</p>
        {page === 2 && (
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
        <div role="img" aria-label={`Step ${page + 1} of 3`} className="row" style={{ gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="onb-pip" style={{ width: i === page ? 28 : 10, opacity: i === page ? 1 : 0.4 }} />
          ))}
        </div>
        <div className="row">
          {page < 2 && (
            <button className="link" style={{ color: "inherit", fontWeight: 500 }} onClick={onDone}>
              Skip
            </button>
          )}
          {step === 0 && (
            <button className="btn lilac" onClick={() => setStep(1)}>
              Next
            </button>
          )}
          {(step === 1 || step === 1.5) && (
            <button className="onb-swipe" onClick={organise} aria-label="Swipe up to put them in line">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 15l6-6 6 6" />
              </svg>
              Swipe up
            </button>
          )}
          {step === 2 && (
            <button className="btn ink shadow" onClick={onDone}>
              Start your line
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
