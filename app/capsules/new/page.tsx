"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../providers";
import { useData } from "@/lib/useData";
import Icon from "@/components/Icon";
import PickMany from "@/components/PickMany";
import { Choice } from "@/components/Dialog";
import { preview } from "@/components/ThoughtCard";
import { CapsuleArt, longDay } from "@/components/Capsule";
import { inWords, keyFile, seal } from "@/lib/capsule";
import { day } from "@/lib/dates";

type Sealed = Awaited<ReturnType<typeof seal>>;
const PRESETS = [
  { label: "1 month", months: 1 },
  { label: "6 months", months: 6 },
  { label: "1 year", months: 12 },
  { label: "5 years", months: 60 },
];
const DAY = 86400000;
/** start of a local day, so a capsule is ready from the morning of its date */
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const inMonths = (n: number) => {
  const d = new Date();
  return dayStart(new Date(d.getFullYear(), d.getMonth() + n, d.getDate()));
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function NewCapsule() {
  const { store } = useApp();
  const router = useRouter();
  const { data: thoughts } = useData(async () => (await store.thoughts()).filter((t) => t.finished), [store]);
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [letter, setLetter] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [preset, setPreset] = useState<number | "custom">(12);
  const [custom, setCustom] = useState("");
  const [kind, setKind] = useState<"key" | "strict">("key");
  const [understood, setUnderstood] = useState(false);
  const [made, setMade] = useState<Sealed | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const tomorrow = ymd(new Date(Date.now() + DAY));
  const openAt = useMemo(() => {
    if (preset !== "custom") return inMonths(preset);
    if (!custom) return null;
    const [y, m, d] = custom.split("-").map(Number);
    const at = new Date(y, m - 1, d);
    return at.getTime() > Date.now() ? at : null;
  }, [preset, custom]);
  const chosen = (thoughts ?? []).filter((t) => picked.includes(t.id));
  const hasSomething = letter.trim().length > 0 || chosen.length > 0;
  const steps = kind === "key" ? 4 : 3;

  const back = () => {
    if (step === 1) return router.back();
    if (step === 4) (setMade(null), setSaved(false), setCopied(false));
    setStep(step - 1);
  };

  const finish = async (sealedWith: Sealed) => {
    if (!openAt) return;
    setBusy(true);
    setErr("");
    try {
      const c = await store.addCapsule({
        title: title.trim() || "Untitled capsule",
        seal: kind,
        open_at: openAt.toISOString(),
        count: chosen.length,
        box: sealedWith.box,
        date_key: sealedWith.date_key,
        key_box: sealedWith.key_box,
      });
      router.replace(`/capsule/?id=${c.id}&sealed=1`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  const inside = () => ({ letter: letter.trim(), thoughts: chosen.map((t) => ({ body: t.body, kind: t.kind, created_at: t.created_at })) });
  const toSeal = async () => {
    if (kind === "strict") return finish(await seal(inside(), false));
    setMade(await seal(inside(), true));
    setStep(4);
  };
  const download = () => {
    if (!made?.key || !openAt) return;
    const blob = new Blob([keyFile(title.trim(), openAt.toISOString(), made.key)], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `strata-capsule-key-${(title.trim() || "capsule").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setSaved(true);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(made!.key!);
      setCopied(true);
    } catch {}
  };

  return (
    <main className="screen no-nav cap-new" style={{ gap: 18 }}>
      <header className="between">
        <button className="icon-btn round" aria-label={step === 1 ? "Back" : "Previous step"} onClick={back}>
          <Icon name="back" />
        </button>
        <h1 className="h-mid">New capsule</h1>
        <span className="small muted" style={{ minWidth: 44, textAlign: "right" }}>
          {step} of {steps}
        </span>
      </header>
      <div className="cap-steps" aria-hidden="true">
        {Array.from({ length: steps }, (_, k) => <i key={k} className={k < step ? "on" : ""} />)}
      </div>

      {step === 1 && (
        <section className="stack" style={{ gap: 14 }}>
          <h2 className="cap-q">What goes inside?</h2>
          <label className="stack" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 600 }}>Give it a name</span>
            <input className="input" value={title} maxLength={120} placeholder="For me, a year from now" onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 600 }}>A letter to future you</span>
            <textarea className="ruled cap-letter" value={letter} placeholder="Dear me, right now I'm…" onChange={(e) => setLetter(e.target.value)} />
          </label>
          <div className="stack" style={{ gap: 8 }}>
            <div className="between">
              <span className="small" style={{ fontWeight: 600 }}>Thoughts to tuck in{chosen.length ? ` · ${chosen.length}` : ""}</span>
              <button className="btn sm" onClick={() => setPicking(true)}>
                <Icon name="plus" size={16} /> Add thoughts
              </button>
            </div>
            <span className="small muted">Copies go in, exactly as they are today. The originals stay where they are.</span>
            {chosen.map((t) => (
              <div key={t.id} className="cap-picked">
                <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                  <span className="serif clamp2">{t.body}</span>
                  <span className="small muted">{day(t.created_at)}</span>
                </span>
                <button className="icon-btn" aria-label="Take it out" onClick={() => setPicked(picked.filter((x) => x !== t.id))}>
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
          </div>
          <button className="btn ink block" disabled={!hasSomething} onClick={() => setStep(2)}>Next: pick a date</button>
          {!hasSomething && <span className="small muted" style={{ textAlign: "center", marginTop: -6 }}>Write a letter or add a thought to carry on.</span>}
        </section>
      )}

      {step === 2 && (
        <section className="stack" style={{ gap: 14 }}>
          <h2 className="cap-q">When should it open?</h2>
          <div className="cap-presets" role="group" aria-label="Open in">
            {PRESETS.map((p) => (
              <button key={p.months} className="chip" aria-pressed={preset === p.months} onClick={() => setPreset(p.months)}>{p.label}</button>
            ))}
            <button className="chip" aria-pressed={preset === "custom"} onClick={() => setPreset("custom")}>Pick a date</button>
          </div>
          {preset === "custom" && <input className="input" type="date" min={tomorrow} value={custom} aria-label="Opening date" onChange={(e) => setCustom(e.target.value)} />}
          {openAt && (
            <div className="card cap-when">
              <CapsuleArt c={{ seal: kind }} size={48} state="sealed" />
              <span className="stack" style={{ gap: 2 }}>
                <strong>Opens {longDay(openAt)}</strong>
                <span className="small muted">{inWords(Math.ceil((openAt.getTime() - Date.now()) / DAY))}. It turns up on Home and in your Inbox that morning.</span>
              </span>
            </div>
          )}
          <button className="btn ink block" disabled={!openAt} onClick={() => setStep(3)}>Next: choose a seal</button>
        </section>
      )}

      {step === 3 && (
        <section className="stack" style={{ gap: 12 }}>
          <h2 className="cap-q">How should it be sealed?</h2>
          <div className="stack" style={{ gap: 10 }} role="radiogroup" aria-label="Seal">
            <Choice on={kind === "key"} title="Seal with a spare key" sub="You get a key once, to save as a file. It opens the capsule early if you really need to. Lose it and you wait for the date." onClick={() => (setKind("key"), setUnderstood(false))} />
            <Choice on={kind === "strict"} title="Strict seal" sub="No key and no way in before the date. Not for you, not for anyone." onClick={() => setKind("strict")} />
          </div>
          {kind === "strict" && (
            <div className="cap-caution" role="note">
              <strong>This can&apos;t be undone</strong>
              <span>Once sealed, nothing opens it before {openAt ? longDay(openAt) : "its date"}. You can still delete it, but you can&apos;t read it.</span>
              <button type="button" role="checkbox" aria-checked={understood} className="cap-agree" onClick={() => setUnderstood(!understood)}>
                <span className={"tick" + (understood ? " on" : "")} style={{ position: "static", margin: 0 }} aria-hidden="true">{understood && <Icon name="check" size={13} width={2.4} color="var(--card)" />}</span>
                I understand
              </button>
            </div>
          )}
          {kind === "key" ? (
            <button className="btn ink block" onClick={toSeal}>Next: make my spare key</button>
          ) : (
            <button className="btn danger-fill block" disabled={!understood || busy} onClick={toSeal}>Seal it for good</button>
          )}
        </section>
      )}

      {step === 4 && made?.key && (
        <section className="stack" style={{ gap: 14 }}>
          <h2 className="cap-q">Your spare key</h2>
          <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
            This is the only time you&apos;ll see it. Strata keeps no copy and can&apos;t make a new one.
          </p>
          <div className="cap-key" aria-label="Spare key">
            {made.key.split("-").map((g, k) => <span key={k}>{g}</span>)}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn butter grow" onClick={download}>
              <Icon name="download" size={17} /> Save as a file
            </button>
            <button className="btn grow" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <button type="button" role="checkbox" aria-checked={saved} className="cap-agree" onClick={() => setSaved(!saved)}>
            <span className={"tick" + (saved ? " on" : "")} style={{ position: "static", margin: 0 }} aria-hidden="true">{saved && <Icon name="check" size={13} width={2.4} color="var(--card)" />}</span>
            I&apos;ve put my key somewhere safe
          </button>
          <button className="btn ink block" disabled={!saved || busy} onClick={() => finish(made)}>Seal it</button>
        </section>
      )}
      {err && <p className="error">{err}</p>}

      {picking && thoughts && (
        <PickMany
          title="Tuck in some thoughts"
          intro="Copies go into the capsule. You'll see them again, with their dates, when it opens."
          items={thoughts.filter((t) => !picked.includes(t.id)).map((t) => ({ id: t.id, title: preview(t.body, 90), sub: day(t.created_at), serif: true }))}
          find="Find a thought"
          empty="No finished thoughts yet."
          confirm={(n) => `Add ${n} ${n === 1 ? "thought" : "thoughts"}`}
          onDone={(ids) => (setPicked([...picked, ...ids]), setPicking(false))}
          onClose={() => setPicking(false)}
        />
      )}
    </main>
  );
}
