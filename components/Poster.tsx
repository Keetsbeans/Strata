"use client";
import { useState } from "react";
import type { InterestKind } from "@/lib/types";

const FILL: Record<InterestKind, string> = { film: "var(--lilac)", book: "var(--butter)", music: "var(--blue)", article: "var(--card)" };

/** A real poster, cover or picture when there is one; otherwise a plain coloured card with the title's first letter. */
export default function Poster({ src, title, kind, className, style }: { src: string | null; title: string; kind: InterestKind; className?: string; style?: React.CSSProperties }) {
  const [broken, setBroken] = useState<string | null>(null);
  const show = src && broken !== src;
  return (
    <span className={"poster " + (className ?? "")} style={{ background: FILL[kind], ...style }} data-kind={kind}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(src)} />
      ) : (
        <span className="poster-letter" aria-hidden="true">
          {title.replace(/^(the|a|an)\s+/i, "").charAt(0).toUpperCase() || "?"}
        </span>
      )}
    </span>
  );
}

/** rating as five dots; tap a dot to set it, tap the same dot again to clear */
export function Dots({ value, onChange, size = 14 }: { value: number | null; onChange?: (v: number | null) => void; size?: number }) {
  const n = value ?? 0;
  if (!onChange)
    return (
      <span role="img" aria-label={value ? `Your rating: ${value} out of 5` : "Not rated"} className="row" style={{ gap: 5 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="dot-r" style={{ width: size, height: size, background: i <= n ? "var(--ink)" : "var(--card)" }} />
        ))}
      </span>
    );
  return (
    <span role="radiogroup" aria-label="Your rating" className="row" style={{ gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} out of 5`} className="dot-btn" onClick={() => onChange(value === i ? null : i)}>
          <span className="dot-r" style={{ width: size, height: size, background: i <= n ? "var(--ink)" : "var(--card)" }} />
        </button>
      ))}
    </span>
  );
}
