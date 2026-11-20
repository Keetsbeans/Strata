"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/app/providers";
import Icon from "./Icon";
import { SearchPanel } from "./SearchPanel";
import Drawer from "./Drawer";

/** Search, Inbox and the menu, at the top right. Search slides in over the screen; the menu opens a drawer from the right. */
export default function TopIcons({ dark }: { dark?: boolean }) {
  const { store } = useApp();
  const [menu, setMenu] = useState<"" | "open" | "closing">("");
  const toggleMenu = () => {
    if (menu === "open") {
      setMenu("closing");
      setTimeout(() => setMenu(""), 380);
    } else if (!menu) setMenu("open");
  };
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    Promise.all([store.links(), store.imports()]).then(([l, i]) => setWaiting(l.length + i.filter((b) => !b.done_at).length)).catch(() => {});
  }, [store]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = "";
    };
  });
  const close = () => {
    setClosing(true);
    setTimeout(() => (setOpen(false), setClosing(false)), 220);
  };
  const cls = "icon-btn round top-icon" + (dark ? " on-dark" : "");
  return (
    <>
      <span className="row" style={{ gap: 6 }}>
        <button className={cls} aria-label="Search" onClick={() => setOpen(true)}>
          <Icon name="search" size={19} />
        </button>
        <Link className={cls} href="/inbox/" aria-label={waiting ? `Inbox, ${waiting} to sort` : "Inbox"}>
          <Icon name="inbox" size={19} />
          {waiting > 0 && <span className="badge-dot" aria-hidden="true" />}
        </Link>
        <button
          className={"menu-btn" + (dark ? " on-dark" : "") + (menu === "open" ? " open" : "") + (menu === "closing" ? " shut" : "")}
          aria-label={menu === "open" ? "Close the menu" : "Menu"}
          aria-expanded={menu === "open"}
          aria-controls="menu-drawer"
          data-tip="menu"
          onClick={toggleMenu}
        >
          <i />
          <i />
        </button>
      </span>
      {menu && <Drawer closing={menu === "closing"} onClose={toggleMenu} />}
      {open && (
        <>
          <div className={"scrim fade" + (closing ? " out" : "")} onClick={close} />
          <div className={"search-sheet" + (closing ? " out" : "")} role="dialog" aria-modal="true" aria-label="Search">
            <SearchPanel close={<button className="btn sm" onClick={close}>Close</button>} />
          </div>
        </>
      )}
    </>
  );
}
