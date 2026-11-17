"use client";
import { useEffect, useRef, type ReactNode } from "react";
import Mascot from "./Mascot";

type Props = {
  title: string;
  body?: ReactNode;
  children?: ReactNode;
  actions: ReactNode;
  face?: "worried" | "asking" | "thinking";
  onClose: () => void;
};

const faces = {
  worried: { eyes: "wide", mouth: "wobble", tilt: 5 },
  asking: { eyes: "look", mouth: "o", tilt: -6 },
  thinking: { eyes: "look", mouth: "flat", arms: "chin", tilt: -5 },
} as const;

/** Confirmation pop-up in the Strata style. Escape or tapping outside closes it. */
export default function Dialog({ title, body, children, actions, face = "asking", onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button, a")?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={title} ref={ref}>
        <Mascot size={66} className="mascot-peek" {...faces[face]} />
        <h2>{title}</h2>
        {body && <p>{body}</p>}
        {children}
        <div className="stack" style={{ gap: 10, marginTop: 8 }}>
          {actions}
        </div>
      </div>
    </>
  );
}

export function Choice({ on, title, sub, onClick }: { on: boolean; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} className="choice" onClick={onClick}>
      <span className="dot" aria-hidden="true" />
      <span className="stack" style={{ gap: 2 }}>
        <strong style={{ fontSize: 15, fontWeight: 600 }}>{title}</strong>
        <span style={{ fontSize: 13, lineHeight: 1.4 }}>{sub}</span>
      </span>
    </button>
  );
}
