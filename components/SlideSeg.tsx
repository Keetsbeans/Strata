"use client";
import type { ReactNode } from "react";
import { useSlider } from "@/lib/slide";

/** a two- or three-way switch whose highlight slides to the picked button */
export default function SlideSeg({ wide, label, dep, children, style }: { wide?: boolean; label: string; dep: unknown; children: ReactNode; style?: React.CSSProperties }) {
  const { ref, pos } = useSlider<HTMLDivElement>('button[aria-pressed="true"]', [dep]);
  return (
    <div className={"seg slides" + (wide ? " wide" : "")} role="group" aria-label={label} ref={ref} style={style}>
      {pos && <span className="seg-thumb" aria-hidden="true" style={{ left: pos.left, width: pos.width }} />}
      {children}
    </div>
  );
}
