"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import Mascot from "./Mascot";
import { tipSeen, markTip } from "@/lib/tips";

export type Step = { at: string; title: string; text: string };

/**
 * A short first-visit guide: dims the page, lights up one thing at a time and says what it's for.
 * One to three steps, shown once per page. The last step says where to turn tips back on.
 * Point a step at an element with data-tip="name".
 */
export default function Guide({ id, steps, wait = 700 }: { id: string; steps: Step[]; wait?: number }) {
  const [on, setOn] = useState(false);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const [vh, setVh] = useState(800);

  useEffect(() => {
    if (tipSeen(id)) return;
    const t = setTimeout(() => setOn(true), wait);
    return () => clearTimeout(t);
  }, [id, wait]);

  // only steps whose target is actually on the page
  const live = on ? steps.filter((s) => typeof document !== "undefined" && document.querySelector(`[data-tip="${s.at}"]`)) : [];
  const step = live[i];

  useLayoutEffect(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tip="${step.at}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    const measure = () => (setBox(el.getBoundingClientRect()), setVh(window.innerHeight));
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => (window.removeEventListener("resize", measure), window.removeEventListener("scroll", measure, true));
  }, [step]);

  if (!on || !live.length || !step || !box) return null;
  const last = i === live.length - 1;
  const finish = () => {
    markTip(id);
    setOn(false);
    window.dispatchEvent(new Event("strata:tip-done"));
  };
  const pad = 6;
  // the note goes wherever there's room: under the lit thing, over it, or pinned to the top
  const room = 230;
  const spaceBelow = vh - box.bottom - 110;
  const where = spaceBelow >= room ? { top: box.bottom + 14 } : box.top >= room ? { bottom: vh - box.top + 14 } : { top: 16 };
  return (
    <div className="tip-layer" role="dialog" aria-modal="true" aria-label={`Tip ${i + 1} of ${live.length}: ${step.title}`}>
      <div className="tip-spot" style={{ left: box.left - pad, top: box.top - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} aria-hidden="true" />
      <div key={i} className="tip-card" style={where}>
        <span className="row" style={{ gap: 10, alignItems: "flex-start" }}>
          <Mascot size={40} eyes="happy" arms={i === 0 ? "wave" : undefined} />
          <span className="stack grow" style={{ gap: 4 }}>
            <strong style={{ fontSize: 16 }}>{step.title}</strong>
            <span className="small">{step.text}</span>
          </span>
        </span>
        {last && (
          <span className="tip-path small">
            <span className="muted">See these tips again any time:</span>
            <span className="row" style={{ gap: 4, flexWrap: "wrap" }}>
              <span className="tip-chip"><span className="tip-burger" aria-hidden="true"><i /><i /></span>Menu</span>›<span className="tip-chip">Settings</span>›<span className="tip-chip">Show tips again</span>
            </span>
          </span>
        )}
        <span className="between">
          <span className="tip-dots" aria-hidden="true">
            {live.map((_, k) => <i key={k} className={k === i ? "on" : ""} />)}
          </span>
          <span className="row" style={{ gap: 4 }}>
            {!last && <button className="link small" style={{ minHeight: 44, minWidth: 44 }} onClick={finish}>Skip</button>}
            <button className="btn sm ink" style={{ minHeight: 44 }} onClick={() => (last ? finish() : setI(i + 1))}>{last ? "Got it" : "Next"}</button>
          </span>
        </span>
      </div>
    </div>
  );
}
