"use client";
import { useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  label?: string;
  onLeft?: () => void;
  onRight?: () => void;
  /** swipe up; the card then takes the touch so the page doesn't scroll */
  onUp?: () => void;
  upHint?: string;
  leftHint?: string;
  rightHint?: string;
  /** called while dragging with -1..1 (left..right), and 0 when let go */
  onLean?: (lean: number) => void;
};

const FAR = 110; // how far (px) the card itself must travel to count as a swipe
const WEIGHT = 0.72; // the card trails the finger a little, so it feels like moving something with some weight
const FLICK = 0.9; // px per ms: a quick flick counts even if it didn't travel all the way

/** A card you can fling left or right with a finger. Buttons inside it still work as normal. */
export default function SwipeCard({ children, className = "", label, onLeft, onRight, onUp, upHint, leftHint, rightHint, onLean }: Props) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const last = useRef({ x: 0, y: 0, t: 0, vx: 0, vy: 0 });
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const axis = useRef<"x" | "y">("x");
  const [state, setState] = useState<"" | "dragging" | "flying" | "settling">("");

  const lean = (x: number) => onLean?.(Math.max(-1, Math.min(1, x / FAR)));

  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("input, textarea, button, a, select, [contenteditable]")) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    last.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, vx: 0, vy: 0 };
  };
  const move = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const x = (e.clientX - s.x) * WEIGHT;
    const y = (e.clientY - s.y) * WEIGHT;
    const l = last.current;
    const dt = Math.max(1, e.timeStamp - l.t);
    last.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, vx: (e.clientX - l.x) / dt, vy: (e.clientY - l.y) / dt };
    if (state !== "dragging") {
      if (onUp && y < -6 && Math.abs(y) > Math.abs(x)) {
        axis.current = "y";
      } else {
        if (Math.abs(x) < 6 || Math.abs(x) < Math.abs(y)) return; // let the page scroll
        axis.current = "x";
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setState("dragging");
    }
    if (axis.current === "y") return setDy(Math.min(0, y));
    if ((x > 0 && !onRight) || (x < 0 && !onLeft)) return setDx(x / 4); // resist a side that does nothing
    setDx(x);
    lean(x);
  };
  const up = () => {
    if (!start.current) return;
    start.current = null;
    if (state !== "dragging") return;
    const { vx, vy } = last.current;
    if (axis.current === "y") {
      if ((dy < -FAR || (dy < -FAR / 2 && vy < -FLICK)) && onUp) {
        setState("flying");
        setDy(-700);
        setTimeout(() => {
          onUp();
          setDy(0);
          setState("");
        }, 380);
      } else {
        setState("settling");
        setDy(0);
        setTimeout(() => setState(""), 460);
      }
      return;
    }
    const right = dx > FAR || (dx > FAR / 2 && vx > FLICK);
    const left = dx < -FAR || (dx < -FAR / 2 && vx < -FLICK);
    const go = right ? onRight : left ? onLeft : undefined;
    if (go) {
      setState("flying");
      setDx(dx > 0 ? 560 : -560);
      setTimeout(() => {
        go();
        onLean?.(0);
        setDx(0);
        setState("");
      }, 380);
    } else {
      setState("settling");
      setDx(0);
      onLean?.(0);
      setTimeout(() => setState(""), 460);
    }
  };

  const shown = Math.min(1, Math.abs(dx) / FAR);
  return (
    <article
      className={`swipe ${state} ${className}`}
      aria-label={label}
      style={{ transform: dy ? `translateY(${dy}px) scale(${1 + dy / 3000})` : dx ? `translateX(${dx}px) rotate(${dx / 28}deg)` : undefined, opacity: state === "flying" ? 0 : 1, touchAction: onUp ? "none" : undefined }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {rightHint && dx > 0 && <span className="swipe-hint right" style={{ opacity: shown }}>{rightHint}</span>}
      {leftHint && dx < 0 && <span className="swipe-hint left" style={{ opacity: shown }}>{leftHint}</span>}
      {upHint && dy < 0 && <span className="swipe-hint up" style={{ opacity: Math.min(1, -dy / FAR) }}>{upHint}</span>}
      {children}
    </article>
  );
}
