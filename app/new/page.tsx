"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { day, time } from "@/lib/dates";

const SKIP = "strata:always-card";

export default function NewThought() {
  const router = useRouter();
  const [skip, setSkip] = useState(false);
  const [now] = useState(() => new Date());
  useEffect(() => {
    try {
      if (localStorage.getItem(SKIP) === "1") router.replace("/write/?kind=card");
    } catch {}
  }, [router]);
  const toggle = () => {
    const v = !skip;
    setSkip(v);
    try {
      if (v) localStorage.setItem(SKIP, "1");
      else localStorage.removeItem(SKIP);
    } catch {}
  };
  return (
    <main className="screen no-nav">
      <header className="between">
        <button className="icon-btn round" aria-label="Back" onClick={() => router.back()}>
          <Icon name="back" />
        </button>
        <span className="small muted">
          {day(now)} · {time(now)}
        </span>
      </header>
      <h1 className="h-title" style={{ marginTop: 8 }}>
        How much room
        <br />
        do you need?
      </h1>
      <Link href="/write/?kind=card" className="card pick" style={{ boxShadow: "3px 3px 0 var(--lilac)" }}>
        <span className="pick-art" aria-hidden="true">
          <span style={{ width: 46, height: 34 }} />
        </span>
        <span className="stack" style={{ gap: 4 }}>
          <strong>A quick card</strong>
          <span>A line or two that fits on one card. Good for a passing thought.</span>
        </span>
      </Link>
      <Link href="/write/?kind=page" className="card pick" style={{ boxShadow: "3px 3px 0 var(--butter)" }}>
        <span className="pick-art" aria-hidden="true">
          <span style={{ width: 34, height: 46 }} />
        </span>
        <span className="stack" style={{ gap: 4 }}>
          <strong>A long reflection</strong>
          <span>A full page, top to bottom. Write as much as you please.</span>
        </span>
      </Link>
      <Link href="/write/?kind=card&jar=1" className="card pick" style={{ boxShadow: "3px 3px 0 var(--ink)", background: "color-mix(in srgb, var(--butter) 35%, var(--card))" }}>
        <span className="pick-art jar-art" aria-hidden="true">
          <span className="jar-mini"><i /></span>
        </span>
        <span className="stack" style={{ gap: 4 }}>
          <strong>For the gratitude jar</strong>
          <span>One small thing you&apos;re grateful for. It goes straight in the jar.</span>
        </span>
      </Link>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        Not sure? Start with a card. If it runs long, it opens into a full page and nothing is lost.
      </p>
      <div className="grow" />
      <label className="row" style={{ minHeight: 44, fontSize: 14 }}>
        <input type="checkbox" checked={skip} onChange={toggle} style={{ width: 20, height: 20, accentColor: "#151515" }} />
        Always start with a card and skip this step
      </label>
    </main>
  );
}
