"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Thought } from "@/lib/types";

/**
 * The gratitude jar: a glass jar with a butter-yellow lid and folded notes inside.
 * The notes have weight: they fall, settle, bump into each other and the glass.
 * Tap the jar and it rattles, and the notes jump about. Tap the lid and it unscrews,
 * and one note, picked at random, comes out and unfolds.
 */

// the stage, in CSS pixels
const SW = 280;
const SH = 360;
// inside of the glass
const IN = { l: 40, r: 240, top: 96, floor: 330, corner: 36 };
const R = 17; // each note behaves like a disc this size
const MAX_SHOWN = 26;
const COLOURS = ["var(--card)", "var(--butter)", "var(--lilac)", "var(--blue)"];

type Body = { id: string; x: number; y: number; vx: number; vy: number; a: number; va: number; c: string };

const calm = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Jar({ notes, onOpen, onEmpty, api }: { notes: Thought[]; onOpen: (t: Thought) => void; onEmpty: () => void; api?: React.MutableRefObject<{ close: () => void } | null> }) {
  const [, redraw] = useState(0);
  const shown = notes.slice(0, MAX_SHOWN);
  const bodies = useRef<Body[]>([]);
  const els = useRef(new Map<string, HTMLSpanElement>());
  const jarEl = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const tilt = useRef({ a: 0, va: 0, push: 0 }); // the jar rocks on a spring
  const [lid, setLid] = useState<"shut" | "opening" | "open" | "closing">("shut");
  const [flying, setFlying] = useState<{ t: Thought; c: string } | null>(null);
  const lastPick = useRef<string | null>(null);

  // keep one body per note shown; new ones drop in from the mouth of the jar
  useEffect(() => {
    const have = new Map(bodies.current.map((b) => [b.id, b]));
    const next: Body[] = [];
    shown.forEach((t, i) => {
      const old = have.get(t.id);
      if (old) return next.push(old);
      // first load: a settled pile, built from the floor up; later additions fall in
      const first = bodies.current.length === 0;
      const perRow = 5;
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      next.push({
        id: t.id,
        x: first ? IN.l + R + 4 + col * ((IN.r - IN.l - 2 * R - 8) / (perRow - 1)) + (row % 2 ? 10 : -4) : SW / 2 + (Math.random() - 0.5) * 30,
        y: first ? IN.floor - R - row * (R * 1.8) : IN.top - 10,
        vx: 0,
        vy: first ? 0 : 2,
        a: (Math.random() - 0.5) * 50,
        va: 0,
        c: COLOURS[[...t.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % COLOURS.length],
      });
    });
    bodies.current = next;
    redraw((n) => n + 1);
    wake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown.map((t) => t.id).join()]);

  const draw = () => {
    for (const b of bodies.current) {
      const el = els.current.get(b.id);
      if (el) el.style.transform = `translate(${b.x - 22}px, ${b.y - 14}px) rotate(${b.a}deg)`;
    }
    if (jarEl.current) jarEl.current.style.transform = `rotate(${tilt.current.a}deg)`;
  };

  const step = useCallback(() => {
    const B = bodies.current;
    const T = tilt.current;
    // the jar on its spring; heavier with more notes inside, so it rocks less
    const mass = 1 + B.length * 0.04;
    T.va += (-0.12 * T.a - 0.16 * T.va + T.push) / mass;
    T.push = 0;
    T.a = Math.max(-14, Math.min(14, T.a + T.va));
    const sideways = -T.va * 0.9; // as the jar swings, the notes lag behind it
    let energy = Math.abs(T.va) + Math.abs(T.a) * 0.2;
    for (const b of B) {
      b.vy += 0.42;
      b.vx += sideways * 0.15;
      b.vx *= 0.985;
      b.vy *= 0.99;
      b.vx = Math.max(-14, Math.min(14, b.vx));
      b.vy = Math.max(-16, Math.min(16, b.vy));
      b.x += b.vx;
      b.y += b.vy;
      b.va = b.va * 0.9 + b.vx * 0.6;
      b.a += b.va * 0.2;
    }
    for (let pass = 0; pass < 4; pass++) {
      // notes push each other apart and trade a little speed
      for (let i = 0; i < B.length; i++)
        for (let j = i + 1; j < B.length; j++) {
          const p = B[i];
          const q = B[j];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const d2 = dx * dx + dy * dy;
          const min = R * 2;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const push = (min - d) / 2;
          p.x -= nx * push;
          p.y -= ny * push;
          q.x += nx * push;
          q.y += ny * push;
          const rel = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
          if (rel < 0) {
            const k = -rel * 0.6;
            p.vx -= nx * k;
            p.vy -= ny * k;
            q.vx += nx * k;
            q.vy += ny * k;
          }
        }
      // the glass: walls, floor, rounded bottom corners, and the shoulders near the top
      for (const b of B) {
        if (b.y > IN.floor - R) (b.y = IN.floor - R), (b.vy = b.vy > 1.5 ? -b.vy * 0.3 : 0), (b.vx *= 0.88);
        if (b.x < IN.l + R) (b.x = IN.l + R), (b.vx = Math.abs(b.vx) * 0.35);
        if (b.x > IN.r - R) (b.x = IN.r - R), (b.vx = -Math.abs(b.vx) * 0.35);
        if (b.y < IN.top + R) (b.y = IN.top + R), (b.vy = Math.abs(b.vy) * 0.3);
        for (const cx of [IN.l + IN.corner, IN.r - IN.corner]) {
          const cy = IN.floor - IN.corner;
          if (b.y < cy || (cx < SW / 2 ? b.x > cx : b.x < cx)) continue;
          const dx = b.x - cx;
          const dy = b.y - cy;
          const d = Math.hypot(dx, dy) || 1;
          const lim = IN.corner - R;
          if (d > lim) {
            b.x = cx + (dx / d) * lim;
            b.y = cy + (dy / d) * lim;
            const out = (b.vx * dx + b.vy * dy) / d;
            if (out > 0) (b.vx -= (dx / d) * out * 1.3), (b.vy -= (dy / d) * out * 1.3);
          }
        }
      }
    }
    for (const b of B) {
      if (!Number.isFinite(b.x + b.y + b.vx + b.vy + b.a)) Object.assign(b, { x: SW / 2, y: IN.floor - R, vx: 0, vy: 0, a: 0, va: 0 });
      energy += Math.abs(b.vx) + Math.abs(b.vy) * 0.5;
    }
    draw();
    // rest when everything is still, so the phone isn't kept busy
    if (energy > 0.25) raf.current = requestAnimationFrame(step);
    else raf.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wake = () => {
    if (calm()) return draw();
    if (!raf.current) raf.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  /** a tap on the glass: the jar rocks away from the finger and the notes jump */
  const rattle = (e: React.PointerEvent) => {
    if (lid !== "shut") return;
    const r = e.currentTarget.getBoundingClientRect();
    const side = (e.clientX - r.left) / r.width < 0.5 ? 1 : -1;
    const strength = 1 / (1 + bodies.current.length * 0.03);
    tilt.current.push += side * 5.5 * strength;
    for (const b of bodies.current) {
      b.vx += side * (1.5 + Math.random() * 3.5) + (Math.random() - 0.5) * 2;
      b.vy -= 2.5 + Math.random() * 5;
      b.va += (Math.random() - 0.5) * 20;
    }
    try {
      navigator.vibrate?.(14);
    } catch {}
    wake();
  };

  /** the lid unscrews, one note rises out and opens */
  const openLid = () => {
    if (lid !== "shut") return;
    if (!shown.length) return onEmpty();
    setLid("opening");
    const pool = shown.length > 1 ? shown.filter((t) => t.id !== lastPick.current) : shown;
    const t = pool[Math.floor(Math.random() * pool.length)];
    lastPick.current = t.id;
    const quick = calm();
    window.setTimeout(() => {
      setLid("open");
      const b = bodies.current.find((x) => x.id === t.id);
      // it climbs out: the others shuffle into the space it leaves
      bodies.current = bodies.current.filter((x) => x.id !== t.id);
      setFlying({ t, c: b?.c ?? "var(--card)" });
      wake();
      window.setTimeout(() => onOpen(t), quick ? 50 : 650);
    }, quick ? 50 : 1150);
  };

  /** called by the page when the note is put back: it drops in and the lid screws shut */
  const close = useCallback(() => {
    setFlying(null);
    setLid("closing");
    const quick = calm();
    window.setTimeout(() => setLid("shut"), quick ? 50 : 1000);
  }, []);
  // let the page close the jar once the note is put back
  if (api) api.current = { close };

  // put the note back as a body once the lid is closing
  useEffect(() => {
    if (lid !== "closing") return;
    const missing = shown.find((t) => !bodies.current.some((b) => b.id === t.id));
    if (missing) {
      bodies.current.push({ id: missing.id, x: SW / 2, y: IN.top + R, vx: (Math.random() - 0.5) * 2, vy: 3, a: 0, va: 6, c: COLOURS[0] });
      redraw((n) => n + 1);
      wake();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lid]);

  return (
    <div className="jar-stage" style={{ width: SW, height: SH }}>
      <div className="jar-rock" ref={jarEl}>
        {/* back of the glass */}
        <svg className="jar-glass back" viewBox={`0 0 ${SW} ${SH}`} width={SW} height={SH} aria-hidden="true">
          <path d={GLASS} fill="color-mix(in srgb, var(--blue) 30%, transparent)" />
        </svg>
        {/* the notes */}
        <div className="jar-notes" onPointerDown={rattle} role="button" tabIndex={0} aria-label="Shake the jar" onKeyDown={(e) => e.key === "Enter" && rattle(e as unknown as React.PointerEvent)}>
          {shown.map((t) => {
            const b = bodies.current.find((x) => x.id === t.id);
            if (!b) return null;
            return (
              <span
                key={t.id}
                className="jar-note"
                ref={(el) => {
                  if (el) els.current.set(t.id, el);
                  else els.current.delete(t.id);
                }}
                style={{ background: b.c, transform: `translate(${b.x - 22}px, ${b.y - 14}px) rotate(${b.a}deg)` }}
              />
            );
          })}
        </div>
        {/* front of the glass: outline and shine */}
        <svg className="jar-glass front" viewBox={`0 0 ${SW} ${SH}`} width={SW} height={SH} aria-hidden="true">
          <path d={GLASS} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M56 140 C 52 190, 52 250, 58 300" stroke="#fff" strokeOpacity="0.75" strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M70 128 C 68 140, 67 150, 67 160" stroke="#fff" strokeOpacity="0.6" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M226 170 C 229 210, 229 250, 224 290" stroke="#fff" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M84 72 H196" stroke="var(--ink)" strokeWidth="2" strokeOpacity="0.5" />
        </svg>
        {/* the lid */}
        <button className={"jar-lid " + lid} onClick={openLid} aria-label={shown.length ? "Open the lid and take a note out" : "Open the lid"}>
          <svg viewBox="0 0 152 52" width="152" height="52" aria-hidden="true">
            <rect x="2" y="12" width="148" height="36" rx="9" fill="var(--butter)" stroke="var(--ink)" strokeWidth="2.5" />
            <rect x="10" y="2" width="132" height="14" rx="6" fill="var(--butter)" stroke="var(--ink)" strokeWidth="2.5" />
            {[22, 38, 54, 70, 86, 102, 118, 134].map((x) => (
              <path key={x} d={`M${x} 20 V42`} stroke="var(--ink)" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
            ))}
            <path d="M14 22 H40" stroke="#fff" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {flying && <span className="jar-fly" style={{ background: flying.c }} aria-hidden="true" />}
    </div>
  );
}

/** the jar's outline: a short neck under the lid, rounded shoulders, a wide body with soft bottom corners */
const GLASS = `M84 64 H196 V80 C 196 92, 244 96, 246 120 V 300 Q 246 336, 210 336 H 70 Q 34 336, 34 300 V 120 C 36 96, 84 92, 84 80 Z`;
