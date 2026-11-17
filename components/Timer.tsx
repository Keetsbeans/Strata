"use client";
import { useEffect, useRef, useState } from "react";

export function fmt(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** optional writing timer, so you don't get carried away */
export function useTimer(defaultMinutes = 5) {
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [left, setLeft] = useState(defaultMinutes * 60000);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const endsAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const l = endsAt.current - Date.now();
      setLeft(Math.max(0, l));
      if (l <= 0) {
        setRunning(false);
        try {
          navigator.vibrate?.([60, 80, 60]);
        } catch {}
      }
    }, 250);
    return () => clearInterval(t);
  }, [running]);

  return {
    minutes,
    left,
    running,
    started,
    done: started && left <= 0,
    setMinutes: (m: number) => {
      setMinutes(m);
      if (!started) setLeft(m * 60000);
    },
    toggle: () => {
      if (running) return setRunning(false);
      const l = started && left > 0 ? left : minutes * 60000;
      endsAt.current = Date.now() + l;
      setLeft(l);
      setStarted(true);
      setRunning(true);
    },
    reset: () => {
      setRunning(false);
      setStarted(false);
      setLeft(minutes * 60000);
    },
  };
}

export function Dial({ left, total, size = 120 }: { left: number; total: number; size?: number }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const frac = total ? left / total : 0;
  const ang = (1 - frac) * 360;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="#FBFAF7" stroke="#151515" strokeWidth="1.5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r - 9}
        fill="none"
        stroke="#C3A6F5"
        strokeWidth="14"
        strokeDasharray={`${(r - 9) * 2 * Math.PI * frac} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={size / 2} y1={10} x2={size / 2} y2={i % 3 ? 15 : 19} stroke="#151515" strokeWidth="1.5" transform={`rotate(${i * 30} ${size / 2} ${size / 2})`} />
      ))}
      <line x1={size / 2} y1={size / 2} x2={size / 2} y2={22} stroke="#151515" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${ang} ${size / 2} ${size / 2})`} />
      <circle cx={size / 2} cy={size / 2} r="4" fill="#151515" />
    </svg>
  );
}

/** scroll-wheel minute picker that ticks (vibrates) at each minute */
export function MinuteWheel({ value, onChange, max = 30 }: { value: number; onChange: (m: number) => void; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const W = 48;
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = (value - 1) * W;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const m = Math.min(max, Math.max(1, Math.round(el.scrollLeft / W) + 1));
    if (m !== value) {
      onChange(m);
      try {
        if (localStorage.getItem("strata:tick") !== "off") navigator.vibrate?.(4);
      } catch {}
    }
  };
  return (
    <div className="wheel-wrap">
      <div className="wheel" ref={ref} onScroll={onScroll} role="slider" aria-label="Minutes" aria-valuemin={1} aria-valuemax={max} aria-valuenow={value} tabIndex={0}
        onKeyDown={(e) => {
          const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          const m = Math.min(max, Math.max(1, value + d));
          onChange(m);
          if (ref.current) ref.current.scrollLeft = (m - 1) * W;
        }}>
        <span style={{ flex: `0 0 calc(50% - ${W / 2}px)` }} />
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={"wheel-n" + (i + 1 === value ? " on" : "")} style={{ flex: `0 0 ${W}px` }}>
            {i + 1}
          </span>
        ))}
        <span style={{ flex: `0 0 calc(50% - ${W / 2}px)` }} />
      </div>
    </div>
  );
}
