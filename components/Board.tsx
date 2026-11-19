"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CollectionItem, Decor, Interest } from "@/lib/types";
import type { Store } from "@/lib/store/types";
import Poster from "./Poster";

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

export default function Board({ store, collectionId, things, decor, onDecor, center }: { store: Store; collectionId: string; things: Thing[]; decor: Decor[]; onDecor: (d: Decor[]) => void; center?: React.MutableRefObject<() => { x: number; y: number }> }) {
  const router = useRouter();
  const view = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState({ x: 0, y: 0, s: 0.62 });
  const [spots, setSpots] = useState<Record<string, Spot>>({});
  const [moving, setMoving] = useState<Grab | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ start?: { x: number; y: number; cx: number; cy: number }; pinch?: { d: number; s: number; mx: number; my: number; cx: number; cy: number }; hold?: number; target?: { kind: "item" | "decor"; id: string }; moved?: boolean; grab?: Grab | null }>({});

  // everything gets a place; ones never moved sit on the loose grid
  useEffect(() => {
    const next: Record<string, Spot> = {};
    things.forEach(({ x }, i) => {
      next[x.id] = x.x != null && x.y != null ? { x: x.x, y: x.y, r: x.r ?? 0, z: x.z ?? i } : gridSpot(i);
    });
    setSpots(next);
  }, [things]);

  const toWorld = (px: number, py: number) => {
    const r = view.current!.getBoundingClientRect();
    return { x: (px - r.left - cam.x) / cam.s, y: (py - r.top - cam.y) / cam.s };
  };
  const topZ = () => Math.max(0, ...Object.values(spots).map((s) => s.z)) + 1;

  const down = (e: React.PointerEvent, target?: { kind: "item" | "decor"; id: string }) => {
    e.stopPropagation();
    view.current?.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (ptrs.current.size === 2) {
      clearTimeout(g.hold);
      const [a, b] = [...ptrs.current.values()];
      const r = view.current!.getBoundingClientRect();
      g.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: cam.s, mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top, cx: cam.x, cy: cam.y };
      g.grab = null;
      setMoving(null);
      return;
    }
    g.start = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y };
    g.moved = false;
    g.target = target;
    g.grab = null;
    if (target) {
      g.hold = window.setTimeout(() => {
        const w = toWorld(e.clientX, e.clientY);
        const at = target.kind === "item" ? spots[target.id] : decor.find((d) => d.id === target.id);
        if (!at) return;
        g.grab = { kind: target.kind, id: target.id, dx: w.x - at.x, dy: w.y - at.y };
        if (target.kind === "item") setSpots((s) => ({ ...s, [target.id]: { ...s[target.id], z: topZ() } }));
        setMoving(g.grab);
        navigator.vibrate?.(12);
      }, 380);
    }
  };
  const move = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g.pinch && ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const s = Math.min(1.6, Math.max(0.35, (g.pinch.s * Math.hypot(a.x - b.x, a.y - b.y)) / g.pinch.d));
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
      if (kind === "item") setSpots((s) => ({ ...s, [id]: { ...s[id], x: w.x - ox, y: w.y - oy } }));
      else onDecor(decor.map((d) => (d.id === id ? { ...d, x: w.x - ox, y: w.y - oy } : d)));
    } else if (g.moved) {
      setCam((c) => ({ ...c, x: g.start!.cx + dx, y: g.start!.cy + dy }));
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
      if (kind === "item" && spots[id]) store.placeItem(id, spots[id]);
      if (kind === "decor") store.updateCollection(collectionId, { decor });
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
    const s = Math.min(1.6, Math.max(0.35, cam.s * (e.deltaY < 0 ? 1.1 : 0.9)));
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    setCam({ s, x: mx - (mx - cam.x) * (s / cam.s), y: my - (my - cam.y) * (s / cam.s) });
  };

  /** the middle of what you can see, in board units */
  const middle = () => {
    const r = view.current?.getBoundingClientRect();
    return r ? { x: (r.width / 2 - cam.x) / cam.s, y: (r.height / 2 - cam.y) / cam.s } : { x: 200, y: 200 };
  };
  if (center) center.current = middle;

  const removeDecor = (id: string) => {
    const next = decor.filter((d) => d.id !== id);
    onDecor(next);
    store.updateCollection(collectionId, { decor: next });
    setPicked(null);
  };

  return (
    <div className="board-wrap">
      <div
        className="board"
        ref={view}
        data-board
        onPointerDown={(e) => down(e)}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={wheel}
        aria-label="Board. Drag to look around, pinch to zoom, long-press a thing to move it."
        role="region"
        style={{ backgroundPosition: `${cam.x}px ${cam.y}px`, backgroundSize: `${22 * cam.s}px ${22 * cam.s}px` }}
      >
        <div className="board-world" style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})` }}>
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
              style={{ left: d.x, top: d.y, transform: `rotate(${d.r}deg)`, zIndex: 900 }}
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
    </div>
  );
}
