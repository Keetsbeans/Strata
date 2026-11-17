"use client";
import Link from "next/link";
import Mascot from "@/components/Mascot";
import { cloudReady } from "@/lib/supabase";
import { useStartTryOut } from "../providers";

export default function Welcome() {
  const tryOut = useStartTryOut();
  return (
    <main className="screen no-nav" style={{ overflow: "hidden" }}>
      <div className="grow" style={{ minHeight: 120 }} />
      <div style={{ position: "relative" }}>
        <Mascot size={72} arms="wave" tilt={-4} className="peek" />
        <div className="card" style={{ padding: "26px 22px", boxShadow: "4px 4px 0 var(--ink)" }}>
          <h1 style={{ fontSize: 48, lineHeight: 1, letterSpacing: "-0.03em" }}>Strata</h1>
          <p className="serif" style={{ fontSize: 22, lineHeight: 1.35, margin: "12px 0 0" }}>
            A private place for what you think, watch, read and hear.
          </p>
        </div>
      </div>
      <div className="grow" />
      <div className="stack" style={{ gap: 10 }}>
        {cloudReady ? (
          <>
            <Link className="btn ink block shadow" href="/signin/?new=1">
              Create an account
            </Link>
            <Link className="btn block" href="/signin/">
              I already have one
            </Link>
            <button className="link" style={{ fontWeight: 500 }} onClick={tryOut}>
              Just try it on this phone first
            </button>
          </>
        ) : (
          <>
            <button className="btn ink block shadow" onClick={tryOut}>
              Try Strata on this phone
            </button>
            <p className="small muted" style={{ margin: 0, textAlign: "center" }}>
              Accounts aren&apos;t switched on yet, so for now your thoughts stay on this phone only.
            </p>
          </>
        )}
        <p className="small muted" style={{ margin: "6px 0 0", textAlign: "center" }}>
          Private by default. Nothing reads or interprets your thoughts.
        </p>
      </div>
    </main>
  );
}
