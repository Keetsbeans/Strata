"use client";
import { useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  label?: string;
  onLeft?: () => void;
  onRight?: () => void;
  leftHint?: string;
  rightHint?: string;
  /** called while dragging with -1..1 (left..right), and 0 when let go */
  onLean?: (lean: number) => void;
};

const FAR = 90; // how far (px) a card must travel to count as a swipe

/** A card you can fling left or right with a finger. Buttons inside it still work as normal. */
export default function SwipeCard({ children, className = "", label, onLeft, onRight, leftHint, rightHint, onLean }: Props) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const [dx, setDx] = useState(0);
  const [state, setState] = useState<"" | "dragging" | "flying" | "settling">("");

  const lean = (x: number) => onLean?.(Math.max(-1, Math.min(1, x / FAR)));

  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("input, textarea, button, a, select, [contenteditable]")) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const move = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const x = e.clientX - s.x;
    if (state !== "dragging") {
      if (Math.abs(x) < 8 || Math.abs(x) < Math.abs(e.clientY - s.y)) return; // let the page scroll
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setState("dragging");
    }
    if ((x > 0 && !onRight) || (x < 0 && !onLeft)) return setDx(x / 4); // resist a side that does nothing
    setDx(x);
    lean(x);
  };
  const up = () => {
    if (!start.current) return;
    start.current = null;
    if (state !== "dragging") return;
    const go = dx > FAR ? onRight : dx < -FAR ? onLeft : undefined;
    if (go) {
      setState("flying");
      setDx(dx > 0 ? 520 : -520);
      setTimeout(() => {
        go();
        onLean?.(0);
        setDx(0);
        setState("");
      }, 260);
    } else {
      setState("settling");
      setDx(0);
      onLean?.(0);
      setTimeout(() => setState(""), 260);
    }
  };

  const shown = Math.min(1, Math.abs(dx) / FAR);
  return (
    <article
      className={`swipe ${state} ${className}`}
      aria-label={label}
      style={{ transform: dx ? `translateX(${dx}px) rotate(${dx / 18}deg)` : undefined, opacity: state === "flying" ? 0 : 1 }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {rightHint && dx > 0 && <span className="swipe-hint right" style={{ opacity: shown }}>{rightHint}</span>}
      {leftHint && dx < 0 && <span className="swipe-hint left" style={{ opacity: shown }}>{leftHint}</span>}
      {children}
    </article>
  );
}
