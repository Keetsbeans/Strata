"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../providers";
import Icon from "@/components/Icon";
import Dialog from "@/components/Dialog";
import { plainTextZip } from "@/lib/exportText";
import { THEMES, getTheme, setTheme, type ThemeId } from "@/lib/theme";
import { getVoiceMode, liveSupported, setVoiceMode } from "@/lib/voice";
import { addFingerprint, fingerprintEnabled, fingerprintSupported, lockEnabled, removeFingerprint, setPin, turnOffLock } from "@/lib/lock";

function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={onChange}>
      <span />
    </button>
  );
}

function Row({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="setting">
      <span className="grow stack" style={{ gap: 2 }}>
        <strong style={{ fontWeight: 600, fontSize: 15 }}>{title}</strong>
        {sub && <span className="small muted">{sub}</span>}
      </span>
      {children}
    </div>
  );
}

export default function Settings() {
  const { store, mode, email, signOut } = useApp();
  const router = useRouter();
  const [lock, setLock] = useState(false);
  const [finger, setFinger] = useState(false);
  const [tick, setTick] = useState(true);
  const [alwaysCard, setAlwaysCard] = useState(false);
  const [live, setLive] = useState(false);
  const [canLive, setCanLive] = useState(false);
  const [pinStep, setPinStep] = useState<null | { first?: string }>(null);
  const [pin, setPinText] = useState("");
  const [msg, setMsg] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [theme, setThemeState] = useState<ThemeId>("lilac");

  useEffect(() => {
    setThemeState(getTheme());
    setLock(lockEnabled());
    setFinger(fingerprintEnabled());
    setLive(getVoiceMode() === "live");
    setCanLive(liveSupported());
    try {
      setTick(localStorage.getItem("strata:tick") !== "off");
      setAlwaysCard(localStorage.getItem("strata:always-card") === "1");
    } catch {}
  }, []);

  const flag = (key: string, value: string | null) => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {}
  };

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) return setMsg("Use 4 digits.");
    if (!pinStep?.first) {
      setPinStep({ first: pin });
      setPinText("");
      return setMsg("Type it once more to be sure.");
    }
    if (pin !== pinStep.first) {
      setPinStep({});
      setPinText("");
      return setMsg("Those didn't match. Start again.");
    }
    await setPin(pin);
    setLock(true);
    setPinStep(null);
    setPinText("");
    setMsg("");
  };

  const toggleFinger = async () => {
    if (finger) {
      removeFingerprint();
      return setFinger(false);
    }
    try {
      await addFingerprint();
      setFinger(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Fingerprint could not be set up on this phone.");
    }
  };

  const exportAll = async () => {
    const data = await store.exportAll();
    const zip = plainTextZip(data as Parameters<typeof plainTextZip>[0]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
    a.download = `strata-export-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <main className="screen no-nav" style={{ gap: 16 }}>
      <header className="between">
        <button className="icon-btn round" aria-label="Back" onClick={() => router.back()}>
          <Icon name="back" />
        </button>
        <h1 className="h-mid">Settings</h1>
        <span style={{ width: 48 }} />
      </header>

      <section className="stack" style={{ gap: 10 }}>
        <h2 style={{ fontSize: 15 }}>Account</h2>
        {mode === "cloud" ? (
          <Row title="Signed in" sub={email ?? undefined}>
            <button className="btn sm" onClick={() => setLeaving(true)}>Sign out</button>
          </Row>
        ) : (
          <Row title="Trying it out" sub="Your thoughts live on this phone only, until accounts are switched on.">
            <button className="btn sm" onClick={() => setLeaving(true)}>Start over</button>
          </Row>
        )}
      </section>

      <section className="stack" style={{ gap: 10 }} role="radiogroup" aria-label="Colour theme">
        <h2 style={{ fontSize: 15 }}>Colour theme</h2>
        {THEMES.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} className="theme-row" onClick={() => (setTheme(t.id), setThemeState(t.id))}>
            <span className="swatch" aria-hidden="true">
              {t.colours.map((c) => (
                <span key={c} style={{ background: c }} />
              ))}
            </span>
            <span className="grow stack" style={{ gap: 0 }}>
              <strong style={{ fontWeight: 600, fontSize: 15 }}>{t.name}</strong>
              <span className="small muted">{t.id === "lilac" ? "The original" : "Extra theme · free while Strata is new"}</span>
            </span>
            {theme === t.id && <span className="tag lilac">In use</span>}
          </button>
        ))}
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <h2 style={{ fontSize: 15 }}>Privacy</h2>
        <Row title="App lock" sub="Ask for a PIN when Strata opens, and after a minute away">
          <Switch
            label="App lock"
            on={lock}
            onChange={() => {
              if (lock) {
                turnOffLock();
                setLock(false);
                setFinger(false);
              } else {
                setPinStep({});
                setMsg("Choose a 4 digit PIN.");
              }
            }}
          />
        </Row>
        {pinStep && (
          <form className="card stack" style={{ gap: 10 }} onSubmit={submitPin}>
            <span>{msg}</span>
            <input className="input" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoFocus autoComplete="off" value={pin} onChange={(e) => setPinText(e.target.value.replace(/\D/g, ""))} aria-label="PIN" style={{ letterSpacing: "0.5em", fontSize: 22 }} />
            <div className="row">
              <button type="button" className="btn grow" onClick={() => (setPinStep(null), setMsg(""))}>Cancel</button>
              <button className="btn ink grow">{pinStep.first ? "Confirm PIN" : "Next"}</button>
            </div>
          </form>
        )}
        {lock && fingerprintSupported() && (
          <Row title="Fingerprint or face" sub="Open Strata with your phone's own unlock">
            <Switch label="Fingerprint or face" on={finger} onChange={toggleFinger} />
          </Row>
        )}
        {!pinStep && msg && <p className="error">{msg}</p>}
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <h2 style={{ fontSize: 15 }}>Writing</h2>
        <Row title="Tick while setting the timer" sub="A small tap at each minute">
          <Switch label="Tick while setting the timer" on={tick} onChange={() => (flag("strata:tick", tick ? "off" : null), setTick(!tick))} />
        </Row>
        <Row title="Always start with a card" sub="Skip the card or page question">
          <Switch label="Always start with a card" on={alwaysCard} onChange={() => (flag("strata:always-card", alwaysCard ? null : "1"), setAlwaysCard(!alwaysCard))} />
        </Row>
        {canLive && (
          <Row
            title="Live voice typing"
            sub={
              live
                ? "On: words appear as you speak, but your phone's speech service (Google on Android, Apple on iPhone) hears your voice."
                : "Off: your voice is turned into text on this phone and never sent anywhere. Turn on to see words appear as you speak."
            }
          >
            <Switch label="Live voice typing" on={live} onChange={() => (setVoiceMode(live ? "private" : "live"), setLive(!live))} />
          </Row>
        )}
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <h2 style={{ fontSize: 15 }}>Your data</h2>
        <Row title="Export everything" sub="Every thought, thread, interest and collection, as plain text files anyone can open">
          <button className="btn sm" onClick={exportAll}>Export</button>
        </Row>
        <Link href="/discarded/" className="setting" style={{ textDecoration: "none" }}>
          <strong className="grow" style={{ fontWeight: 600, fontSize: 15 }}>Discarded thoughts</strong>
          <Icon name="back" size={18} />
        </Link>
      </section>

      <p className="small muted" style={{ textAlign: "center" }}>Strata · stage 2 · Time capsules arrive in the next stage.</p>

      {leaving && (
        <Dialog
          title={mode === "cloud" ? "Sign out?" : "Start over?"}
          body={mode === "cloud" ? "Your thoughts stay safe in your account. The app lock on this phone is switched off." : "Your try-out thoughts on this phone will be erased."}
          face="asking"
          onClose={() => setLeaving(false)}
          actions={
            <>
              <button className="btn ink block" onClick={signOut}>{mode === "cloud" ? "Sign out" : "Erase and start over"}</button>
              <button className="btn block" onClick={() => setLeaving(false)}>Stay</button>
            </>
          }
        />
      )}
    </main>
  );
}
