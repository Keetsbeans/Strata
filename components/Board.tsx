"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CollectionItem, Decor, Interest } from "@/lib/types";
import type { Store } from "@/lib/store/types";
import Poster from "./Poster";
import Icon from "./Icon";

/** where a thing sits on the board until it is moved: a loose grid with a little tilt */
const W = 170;
const H = 250;
const TILT = [-4, 3, -2, 5, -3, 2, -5, 4];
export function gridSpot(i: number) {
  return { x: 24 + (i % 3) * (W + 24), y: 24 + Math.floor(i / 3) * (H + 30) + (i % 3 === 1 ? 18 : 0), r: TILT[i % TILT.length], z: i };
}

export const STICKERS: Record<string, { label: string; svg: React.ReactNode }> = {
  smile: { label: "Smiling face", svg: <><circle cx="20" cy="20" r="15" fill="var(--butter)" /><circle cx="15" cy="17" r="1.8" fill="currentColor" stroke="none" /><circle cx="25" cy="17" r="1.8" fill="currentColor" stroke="none" /><path d="M14 24c3 3 9 3 12 0" /></> },
  wow: { label: "Surprised face", svg: <><circle cx="20" cy="20" r="15" fill="var(--lilac)" /><circle cx="15" cy="16" r="1.8" fill="currentColor" stroke="none" /><circle cx="25" cy="16" r="1.8" fill="currentColor" stroke="none" /><circle cx="20" cy="25" r="3" /></> },
  meh: { label: "Thinking face", svg: <><circle cx="20" cy="20" r="15" fill="var(--blue)" /><circle cx="15" cy="17" r="1.8" fill="currentColor" stroke="none" /><circle cx="25" cy="17" r="1.8" fill="currentColor" stroke="none" /><path d="M15 25h10" /></> },
  star: { label: "Star", svg: <path d="M20 5l4.4 9.6 10.4 1.1-7.8 7 2.2 10.3L20 27.7 10.8 33l2.2-10.3-7.8-7 10.4-1.1z" fill="var(--butter)" /> },
  heart: { label: "Heart", svg: <path d="M20 33s-12-7.4-12-16a6.9 6.9 0 0 1 12-4.6A6.9 6.9 0 0 1 32 17c0 8.6-12 16-12 16z" fill="var(--lilac)" /> },
  tape: { label: "Tape", svg: <rect x="4" y="13" width="32" height="12" rx="1" fill="var(--butter)" opacity="0.85" transform="rotate(-8 20 19)" /> },
  arrow: { label: "Arrow", svg: <><path d="M7 28c4-10 13-15 24-14" /><path d="M26 9l6 5-6 5" /></> },
  sparkle: { label: "Sparkle", svg: <path d="M20 5v8M20 27v8M5 20h8M27 20h8M10 10l5 5M25 25l5 5M30 10l-5 5M15 25l-5 5" /> },
};

type Thing = { x: CollectionItem; it: Interest };
type Spot = { x: number; y: number; r: number; z: number };
type Grab = { kind: "item" | "decor"; id: string; dx: number; dy: number };
type Snap = { spots: Record<string, Spot>; decor: Decor[] };
type Cam = { x: number; y: number; s: number };

/** the board is a sheet of a fixed size: room to spread out, but it has edges, so nothing gets lost */
export const SHEET = { w: 1100, h: 1500 };
const D = 64; // a sticker or label, roughly
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
const fitSpot = (s: Spot): Spot => ({ ...s, x: clamp(s.x, 0, SHEET.w - W), y: clamp(s.y, 0, SHEET.h - H), r: Number.isFinite(s.r) ? s.r : 0 });
const fitDecor = (d: Decor): Decor => ({ ...d, x: clamp(d.x, 0, SHEET.w - D * 2), y: clamp(d.y, 0, SHEET.h - D) });
const DOCK = 84; // the tools dock covers the bottom of the board
const PAD = 24;
const MIN_S = 0.34;
const MAX_S = 1.6;

export default function Board({ store, collectionId, things, decor, onDecor, center, tools }: { store: Store; collectionId: string; things: Thing[]; decor: Decor[]; onDecor: (d: Decor[]) => void; center?: React.MutableRefObject<() => { x: number; y: number }>; tools?: React.ReactNode }) {
  const router = useRouter();
  const view = useRef<HTMLDivElement>(null);
  const [cam, setCamRaw] = useState<Cam>({ x: PAD, y: PAD, s: 0.62 });
  /** the view stays on the sheet: it can't be pulled past an edge, and a small sheet sits in the middle */
  const fitCam = (n: Cam): Cam => {
    const r = view.current?.getBoundingClientRect();
    const s = clamp(n.s, MIN_S, MAX_S);
    if (!r || !r.width) return { ...n, s };
    const vw = r.width;
    const vh = Math.max(120, r.height - DOCK);
    const axis = (v: number, size: number, room: number) => (size + PAD * 2 <= room ? (room - size) / 2 : clamp(v, room - size - PAD, PAD));
    return { s, x: axis(n.x, SHEET.w * s, vw), y: axis(n.y, SHEET.h * s, vh) };
  };
  const setCam = (next: Cam | ((c: Cam) => Cam)) =>
    setCamRaw((c) => {
      const n = typeof next === "function" ? next(c) : next;
      return [n.x, n.y, n.s].every(Number.isFinite) ? fitCam(n) : c;
    });
  const [spots, setSpots] = useState<Record<string, Spot>>({});
  const spotsRef = useRef(spots);
  spotsRef.current = spots;
  const decorRef = useRef(decor);
  const [moving, setMoving] = useState<Grab | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ start?: { x: number; y: number; cx: number; cy: number }; pinch?: { d: number; s: number; mx: number; my: number; cx: number; cy: number }; hold?: number; target?: { kind: "item" | "decor"; id: string }; moved?: boolean; grab?: Grab | null }>({});

  // everything gets a place on the sheet; ones never moved sit on the loose grid
  useEffect(() => {
    const next: Record<string, Spot> = {};
    things.forEach(({ x }, i) => {
      next[x.id] = fitSpot(x.x != null && x.y != null ? { x: x.x, y: x.y, r: x.r ?? 0, z: x.z ?? i } : gridSpot(i));
    });
    setSpots(next);
  }, [things]);
  // settle the view once the board has its size
  useEffect(() => {
    setCam((c) => c);
    const ro = new ResizeObserver(() => setCam((c) => c));
    if (view.current) ro.observe(view.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // undo and redo: a snapshot before every change
  const hist = useRef<{ past: Snap[]; future: Snap[] }>({ past: [], future: [] });
  const [, setVersion] = useState(0);
  const applying = useRef(false);
  const snap = (): Snap => ({ spots: spotsRef.current, decor: decorRef.current });
  const record = (before: Snap = snap()) => {
    hist.current.past = [...hist.current.past.slice(-29), before];
    hist.current.future = [];
    setVersion((v) => v + 1);
  };
  // stickers and labels added or taken off from outside count as changes too
  useEffect(() => {
    const prev = decorRef.current;
    decorRef.current = decor;
    if (!applying.current && prev.length !== decor.length) record({ spots: spotsRef.current, decor: prev });
    applying.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decor]);
  const apply = (to: Snap) => {
    const from = spotsRef.current;
    setSpots(to.spots);
    for (const [id, sp] of Object.entries(to.spots)) if (from[id] !== sp) store.placeItem(id, sp);
    if (to.decor !== decorRef.current) {
      applying.current = to.decor.length !== decorRef.current.length;
      onDecor(to.decor);
      store.updateCollection(collectionId, { decor: to.decor });
    }
    setPicked(null);
    setVersion((v) => v + 1);
  };
  const undo = () => {
    const h = hist.current;
    const to = h.past.pop();
    if (!to) return;
    h.future.push(snap());
    apply(to);
  };
  const redo = () => {
    const h = hist.current;
    const to = h.future.pop();
    if (!to) return;
    h.past.push(snap());
    apply(to);
  };
  /** back into neat rows, and the view back to the top */
  const tidy = () => {
    record();
    const next: Record<string, Spot> = {};
    things.forEach(({ x }, i) => (next[x.id] = gridSpot(i)));
    setSpots(next);
    things.forEach(({ x }) => store.placeItem(x.id, next[x.id]));
    setCam({ x: PAD, y: PAD, s: 0.62 });
  };

  const toWorld = (px: number, py: number) => {
    const r = view.current!.getBoundingClientRect();
    return { x: (px - r.left - cam.x) / cam.s, y: (py - r.top - cam.y) / cam.s };
  };
  const topZ = () => Math.max(0, ...Object.values(spots).map((s) => s.z)) + 1;

  const down = (e: React.PointerEvent, target?: { kind: "item" | "decor"; id: string }) => {
    e.stopPropagation();
    try {
      view.current?.setPointerCapture(e.pointerId);
    } catch {}
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (ptrs.current.size >= 2) {
      clearTimeout(g.hold);
      const [a, b] = [...ptrs.current.values()];
      const r = view.current!.getBoundingClientRect();
      g.pinch = { d: Math.max(24, Math.hypot(a.x - b.x, a.y - b.y)), s: cam.s, mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top, cx: cam.x, cy: cam.y };
      if (g.grab) setMoving(null);
      g.grab = null;
      return;
    }
    g.start = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y };
    g.moved = false;
    g.target = target;
    g.grab = null;
    if (target) {
      g.hold = window.setTimeout(() => {
        const w = toWorld(e.clientX, e.clientY);
        const at = target.kind === "item" ? spotsRef.current[target.id] : decorRef.current.find((d) => d.id === target.id);
        if (!at) return;
        record();
        g.grab = { kind: target.kind, id: target.id, dx: w.x - at.x, dy: w.y - at.y };
        if (target.kind === "item") setSpots((s) => (s[target.id] ? { ...s, [target.id]: { ...s[target.id], z: topZ() } } : s));
        setMoving(g.grab);
        try {
          navigator.vibrate?.(12);
        } catch {}
      }, 380);
    }
  };
  const move = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g.pinch) {
      if (ptrs.current.size < 2) return;
      const [a, b] = [...ptrs.current.values()];
      const s = clamp((g.pinch.s * Math.hypot(a.x - b.x, a.y - b.y)) / g.pinch.d, MIN_S, MAX_S);
      const k = s / g.pinch.s;
      setCam({ s, x: g.pinch.mx - (g.pinch.mx - g.pinch.cx) * k, y: g.pinch.my - (g.pinch.my - g.pinch.cy) * k });
      return;
    }
    if (!g.start) return;
    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) > 8) {
      g.moved = true;
      if (!g.grab) clearTimeout(g.hold);
    }
    if (g.grab) {
      const w = toWorld(e.clientX, e.clientY);
      const { id, kind, dx: ox, dy: oy } = g.grab;
      if (kind === "item") setSpots((s) => (s[id] ? { ...s, [id]: fitSpot({ ...s[id], x: w.x - ox, y: w.y - oy }) } : s));
      else onDecor(decorRef.current.map((d) => (d.id === id ? fitDecor({ ...d, x: w.x - ox, y: w.y - oy }) : d)));
    } else if (g.moved) {
      const st = g.start;
      setCam((c) => ({ ...c, x: st.cx + dx, y: st.cy + dy }));
    }
  };
  const up = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    const g = gesture.current;
    clearTimeout(g.hold);
    if (g.pinch) {
      if (ptrs.current.size === 0) g.pinch = undefined;
      g.start = undefined;
      return;
    }
    if (g.grab) {
      const { id, kind } = g.grab;
      if (kind === "item" && spotsRef.current[id]) store.placeItem(id, spotsRef.current[id]);
      if (kind === "decor") store.updateCollection(collectionId, { decor: decorRef.current });
      setMoving(null);
      setPicked(kind === "decor" ? id : null);
    } else if (!g.moved && g.target) {
      if (g.target.kind === "item") {
        const t = things.find((x) => x.x.id === g.target!.id);
        if (t) router.push(`/interest/?id=${t.it.id}`);
      } else setPicked(picked === g.target.id ? null : g.target.id);
    } else if (!g.moved) setPicked(null);
    g.grab = null;
    g.start = undefined;
    g.target = undefined;
  };
  const wheel = (e: React.WheelEvent) => {
    const r = view.current!.getBoundingClientRect();
    const s = clamp(cam.s * (e.deltaY < 0 ? 1.1 : 0.9), MIN_S, MAX_S);
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    setCam({ s, x: mx - (mx - cam.x) * (s / cam.s), y: my - (my - cam.y) * (s / cam.s) });
  };

  /** the middle of what you can see, in board units, kept on the sheet */
  const middle = () => {
    const r = view.current?.getBoundingClientRect();
    const m = r ? { x: (r.width / 2 - cam.x) / cam.s, y: ((r.height - DOCK) / 2 - cam.y) / cam.s } : { x: 200, y: 200 };
    return { x: clamp(m.x, D, SHEET.w - D * 2), y: clamp(m.y, D, SHEET.h - D * 2) };
  };
  if (center) center.current = middle;

  const removeDecor = (id: string) => {
    const next = decor.filter((d) => d.id !== id);
    onDecor(next);
    store.updateCollection(collectionId, { decor: next });
    setPicked(null);
  };

  const h = hist.current;
  return (
    <div className="board-wrap">
      <div className="board-undo" role="group" aria-label="Undo and redo" data-tip="board-undo">
        <button className="icon-btn round" aria-label="Undo" disabled={!h.past.length} onClick={undo}>
          <Icon name="undo" size={18} />
        </button>
        <button className="icon-btn round" aria-label="Redo" disabled={!h.future.length} onClick={redo}>
          <Icon name="redo" size={18} />
        </button>
      </div>
      <div
        className="board"
        data-tip="board"
        ref={view}
        data-board
        onPointerDown={(e) => down(e)}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={wheel}
        aria-label="Board. Drag to look around, pinch to zoom, long-press a thing to move it."
        role="region"
      >
        <div className="board-world" style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})` }}>
          <div className="board-sheet" style={{ width: SHEET.w, height: SHEET.h }} aria-hidden="true" />
          {things.map(({ x, it }, i) => {
            const s = spots[x.id];
            if (!s) return null;
            const isMoving = moving?.kind === "item" && moving.id === x.id;
            return (
              <div
                key={x.id}
                className={"board-item" + (isMoving ? " moving" : "")}
                role="link"
                tabIndex={0}
                aria-label={it.title}
                style={{ left: s.x, top: s.y, zIndex: s.z, transform: `rotate(${s.r + (isMoving ? 3 : 0)}deg) scale(${isMoving ? 1.05 : 1})` }}
                onPointerDown={(e) => down(e, { kind: "item", id: x.id })}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/interest/?id=${it.id}`)}
              >
                {i % 3 === 0 && <span className="board-tape" aria-hidden="true" />}
                {isMoving && <span className="board-moving">Moving…</span>}
                {it.kind === "article" ? (
                  <span className="board-link">
                    <strong>{it.title}</strong>
                  </span>
                ) : (
                  <Poster src={it.image_url} title={it.title} kind={it.kind} />
                )}
                {it.kind !== "article" && <span className="board-cap">{it.title}</span>}
              </div>
            );
          })}
          {decor.map((d) => (
            <div
              key={d.id}
              className={"board-decor " + d.kind + (picked === d.id ? " picked" : "") + (moving?.id === d.id ? " moving" : "")}
              style={{ left: clamp(d.x, 0, SHEET.w - D * 2), top: clamp(d.y, 0, SHEET.h - D), transform: `rotate(${d.r}deg)`, zIndex: 900 }}
              onPointerDown={(e) => down(e, { kind: "decor", id: d.id })}
              role="img"
              aria-label={d.kind === "label" ? `Label: ${d.name}` : STICKERS[d.name]?.label ?? "Sticker"}
            >
              {d.kind === "label" ? (
                <span>{d.name}</span>
              ) : (
                <svg viewBox="0 0 40 40" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {STICKERS[d.name]?.svg}
                </svg>
              )}
            </div>
          ))}
        </div>
        {picked && (
          <button className="btn sm board-remove" onPointerDown={(e) => e.stopPropagation()} onClick={() => removeDecor(picked)}>
            Take this off
          </button>
        )}
      </div>
      <div className="board-dock" data-tip="board-tools" role="toolbar" aria-label="Decorate the board">
        {tools}
        <button onClick={tidy}>Tidy up</button>
      </div>
    </div>
  );
}
