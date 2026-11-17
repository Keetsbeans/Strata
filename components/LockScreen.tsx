"use client";
import { useEffect, useState } from "react";
import Mascot from "./Mascot";
import Icon from "./Icon";
import { checkPin, fingerprintEnabled, markUnlocked, unlockWithFingerprint } from "@/lib/lock";
import Dialog from "./Dialog";

export default function LockScreen({ onUnlock, onForgot, tryOut }: { onUnlock: () => void; onForgot: () => void; tryOut: boolean }) {
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [msg, setMsg] = useState("Enter your PIN to open it");
  const [forgot, setForgot] = useState(false);
  const [, tick] = useState(0);

  const open = () => {
    markUnlocked();
    onUnlock();
  };

  const finger = async () => {
    if (await unlockWithFingerprint()) open();
  };
  useEffect(() => {
    if (fingerprintEnabled()) finger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!waitUntil) return;
    const t = setInterval(() => (Date.now() > waitUntil ? (setWaitUntil(0), setMsg("Enter your PIN to open it")) : tick((n) => n + 1)), 500);
    return () => clearInterval(t);
  }, [waitUntil]);

  const press = async (d: string) => {
    if (waitUntil || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      if (await checkPin(next)) return open();
      const w = wrong + 1;
      setWrong(w);
      setPin("");
      if (w % 5 === 0) {
        setWaitUntil(Date.now() + 30_000);
        setMsg("Too many tries. Wait 30 seconds.");
      } else setMsg("That PIN didn't match. Try again.");
    }
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const key = (k: string) => (
    <button key={k} type="button" className="lock-key" onClick={() => press(k)} disabled={Boolean(waitUntil)}>
      {k}
    </button>
  );

  return (
    <main className="lock">
      <Mascot size={70} eyes="closed" mouth="flat" line="#FBFAF7" />
      <h1 style={{ fontSize: 26, letterSpacing: "-0.01em" }}>Strata is locked</h1>
      <p role="status" style={{ margin: 0, fontSize: 15, color: "var(--on-dark)" }}>
        {msg}
      </p>
      <div role="img" aria-label={`${pin.length} of 4 digits entered`} className="row" style={{ gap: 14, margin: "10px 0 14px" }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="lock-dot" style={{ background: i < pin.length ? "var(--lilac)" : "transparent" }} />
        ))}
      </div>
      <div className="lock-pad">
        {"123456789".split("").map(key)}
        {fingerprintEnabled() ? (
          <button type="button" className="lock-key plain" aria-label="Use fingerprint" onClick={finger}>
            <Icon name="finger" size={30} color="#C3A6F5" width={1.8} />
          </button>
        ) : (
          <span />
        )}
        {key("0")}
        <button type="button" className="lock-key plain" aria-label="Delete" onClick={() => setPin((p) => p.slice(0, -1))}>
          <Icon name="backspace" size={26} color="#FBFAF7" width={2} />
        </button>
      </div>
      <div className="grow" />
      <button type="button" className="link" style={{ color: "var(--on-dark)", fontWeight: 500 }} onClick={() => setForgot(true)}>
        Forgot your PIN? {tryOut ? "Start over" : "Sign in again"}
      </button>
      {forgot && (
        <Dialog
          title={tryOut ? "Start over?" : "Sign in again?"}
          body={
            tryOut
              ? "Your try-out thoughts only live on this phone and are protected by the PIN, so starting over erases them."
              : "You'll be signed out and the PIN is removed. Your thoughts are safe in your account."
          }
          face="worried"
          onClose={() => setForgot(false)}
          actions={
            <>
              <button className="btn ink block" onClick={onForgot}>
                {tryOut ? "Erase and start over" : "Sign out"}
              </button>
              <button className="btn block" onClick={() => setForgot(false)}>
                Try the PIN again
              </button>
            </>
          }
        />
      )}
    </main>
  );
}
