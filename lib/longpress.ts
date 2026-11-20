"use client";
import { useRef } from "react";

/**
 * Press and hold for a quick menu. Works with a finger (a timer) and with the phone's own long-press
 * (the context menu, which is then kept from showing). The tap that ends a long press doesn't also open the link.
 */
export function useLongPress(onLong: () => void, ms = 480) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const fire = () => {
    if (fired.current) return;
    fired.current = true;
    stop();
    try {
      navigator.vibrate?.(12);
    } catch {}
    onLong();
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      stop();
      timer.current = setTimeout(fire, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) stop();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      fire();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
  };
}
