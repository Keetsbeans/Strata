"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import Nav from "@/components/Nav";
import Icon from "@/components/Icon";
import Mascot from "@/components/Mascot";
import Guide from "@/components/Guide";
import { CapsuleArt, CapsuleLine, longDay } from "@/components/Capsule";
import { inWords, isReady, progress, whatsInside } from "@/lib/capsule";
import type { TimeCapsule } from "@/lib/types";

function Row({ c }: { c: TimeCapsule }) {
  const state = c.opened_at ? "opened" : isReady(c) ? "ready" : "sealed";
  const p = progress(c);
  return (
    <Link href={`/capsule/?id=${c.id}`} className={"card cap-row " + state}>
      <span className="row" style={{ gap: 12, alignItems: "flex-start" }}>
        <CapsuleArt c={c} size={52} state={state} />
        <span className="stack grow" style={{ gap: 3, minWidth: 0 }}>
          <strong className="cap-title">{c.title || "Untitled capsule"}</strong>
          <span className="small muted">
            {state === "opened" ? `Opened ${longDay(c.opened_at!, false)}${c.opened_early ? ", early" : ""}` : state === "ready" ? "Ready to open" : `Opens ${longDay(c.open_at)} · ${inWords(p.daysLeft)}`}
          </span>
          <span className="small muted">{whatsInside(c)}</span>
        </span>
        {state === "ready" ? <span className="tag sm butter">Open me</span> : state === "sealed" && <span className={"tag sm " + (c.seal === "strict" ? "strict" : "")}>{c.seal === "strict" ? "Strict" : "Spare key"}</span>}
      </span>
      {state === "sealed" && <CapsuleLine c={c} compact />}
    </Link>
  );
}

export default function Capsules() {
  const { store } = useApp();
  const router = useRouter();
  const { data, error } = useData(() => store.capsules(), [store]);
  if (error) return <main className="screen"><p className="error">{error}</p><Nav /></main>;
  if (!data) return <main className="screen"><Nav /></main>;
  const ready = data.filter((c) => !c.opened_at && isReady(c));
  const sealed = data.filter((c) => !c.opened_at && !isReady(c));
  const opened = data.filter((c) => c.opened_at).sort((a, b) => b.opened_at!.localeCompare(a.opened_at!));

  return (
    <>
      <main className="screen" style={{ gap: 18 }}>
        <header className="between">
          <button className="icon-btn round" aria-label="Back" onClick={() => router.back()}>
            <Icon name="back" />
          </button>
          <h1 className="h-mid">Time capsules</h1>
          <Link className="btn sm ink" href="/capsules/new/" data-tip="cap-new">
            <Icon name="plus" size={16} /> New
          </Link>
        </header>
        <p className="muted" style={{ margin: "-6px 0 0", fontSize: 14 }}>
          Seal a letter and a few thoughts away until a date. Strata scrambles them on this phone and keeps them shut until the day.
        </p>

        {data.length === 0 && (
          <div className="empty" data-tip="cap-empty">
            <Mascot size={72} eyes="happy" arms="wave" />
            <h2>Write to future you</h2>
            <p>Pick a date, write a letter, tuck in some thoughts, and seal it. It comes back to you on the day.</p>
            <Link className="btn ink" href="/capsules/new/">Make your first capsule</Link>
          </div>
        )}

        {ready.length > 0 && (
          <section className="stack" style={{ gap: 10 }}>
            <h2 style={{ fontSize: 17 }}>Ready to open · {ready.length}</h2>
            {ready.map((c) => <Row key={c.id} c={c} />)}
          </section>
        )}
        {sealed.length > 0 && (
          <section className="stack" style={{ gap: 10 }} data-tip="cap-sealed">
            <h2 style={{ fontSize: 17 }}>Sealed · {sealed.length}</h2>
            {sealed.map((c) => <Row key={c.id} c={c} />)}
          </section>
        )}
        {opened.length > 0 && (
          <section className="stack" style={{ gap: 10 }}>
            <h2 style={{ fontSize: 17 }}>Opened · {opened.length}</h2>
            {opened.map((c) => <Row key={c.id} c={c} />)}
          </section>
        )}
      </main>
      <Nav />
      <Guide
        id="capsules"
        steps={[
          { at: "cap-new", title: "Make a capsule", text: "Write a letter to future you, add a few thoughts, choose the day it opens, then seal it." },
          ...(sealed.length ? [{ at: "cap-sealed", title: "Waiting for their day", text: "The line shows how far along the wait is. On the day, the capsule turns up on Home and in your Inbox." }] : []),
        ]}
      />
    </>
  );
}
