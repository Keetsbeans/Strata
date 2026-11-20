"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/app/providers";
import { getName } from "@/lib/profile";
import Icon from "./Icon";
import Mascot from "./Mascot";

/** The More drawer: everything that doesn't need a place in the bottom bar. Slides in from the right. */
export default function Drawer({ onClose }: { onClose: () => void }) {
  const { store } = useApp();
  const [closing, setClosing] = useState(false);
  const [threads, setThreads] = useState<number | null>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    setName(getName());
    store.threads().then((t) => setThreads(t.length)).catch(() => {});
  }, [store]);
  const close = () => {
    setClosing(true);
    setTimeout(onClose, 220);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = "";
    };
  });
  const row = (href: string, icon: string, label: string, sub: string, n?: number | null) => (
    <Link href={href} className="drawer-row" onClick={close}>
      <span className="drawer-ic"><Icon name={icon} size={19} /></span>
      <span className="grow stack" style={{ gap: 1 }}>
        <strong>{label}</strong>
        <span className="small muted">{sub}</span>
      </span>
      {n != null && <span className="drawer-n">{n}</span>}
    </Link>
  );
  return (
    <>
      <div className={"scrim fade" + (closing ? " out" : "")} onClick={close} />
      <aside className={"drawer" + (closing ? " out" : "")} role="dialog" aria-modal="true" aria-label="More">
        <div className="between">
          <Link href="/profile/" className="drawer-me" onClick={close}>
            <Mascot size={44} eyes="happy" arms="wave" />
            <span className="stack" style={{ gap: 0 }}>
              <strong>{name || "Your profile"}</strong>
              <span className="small muted">Profile and export</span>
            </span>
          </Link>
          <button className="icon-btn round" aria-label="Close" onClick={close}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <nav className="stack" style={{ gap: 6 }} aria-label="More">
          {row("/threads/", "thread", "Threads", "One idea, followed over time", threads)}
          <div className="drawer-row soon" aria-disabled="true">
            <span className="drawer-ic"><Icon name="clock" size={19} /></span>
            <span className="grow stack" style={{ gap: 1 }}>
              <strong>Time capsules</strong>
              <span className="small muted">Seal thoughts away until a date</span>
            </span>
            <span className="tag sm butter">Coming next</span>
          </div>
          {row("/calendar/", "calendar", "Calendar", "Every day you wrote")}
          {row("/interests/import/", "download", "Import", "Films from Letterboxd, books from Goodreads")}
          {row("/discarded/", "trash", "Discarded", "Kept for 30 days, then gone")}
          {row("/settings/", "settings", "Settings", "Themes, voice typing, lock")}
        </nav>
      </aside>
    </>
  );
}
