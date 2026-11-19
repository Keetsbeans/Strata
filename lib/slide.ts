"use client";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * Measures the selected child of a row so a highlight can slide to it.
 * `from` remembers where it was last time (by key), so a new page can start
 * the highlight where the old page left it and glide over.
 */
const last = new Map<string, { left: number; width: number }>();

export function useSlider<T extends HTMLElement>(selector: string, deps: unknown[], key?: string) {
  const ref = useRef<T>(null);
  const [pos, setPos] = useState<{ left: number; width: number } | null>(key ? last.get(key) ?? null : null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current?.querySelector<HTMLElement>(selector);
      if (!el || !ref.current) return setPos(null);
      const box = ref.current.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const p = { left: r.left - box.left, width: r.width };
      if (key) last.set(key, p);
      setPos(p);
    };
    // one frame later, so a remembered start position paints first and the move animates
    const id = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ref, pos };
}
