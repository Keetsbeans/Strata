"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Icon from "./Icon";
import { useSlider } from "@/lib/slide";
import Drawer from "./Drawer";

const items = [
  { href: "/", label: "Home" },
  { href: "/thoughts/", label: "Thoughts", also: ["/thought/", "/review/", "/stack/"] },
  { href: "/new/", label: "New thought", plus: true, also: ["/write/"] },
  { href: "/collections/", label: "Collections", also: ["/interests/", "/interest/", "/collection/", "/import/"] },
];
// pages that live in the More drawer
const MORE = ["/threads/", "/thread/", "/calendar/", "/discarded/", "/profile/", "/settings/"];

export default function Nav() {
  const path = usePathname() || "/";
  const norm = path.endsWith("/") ? path : path + "/";
  const [tapped, setTapped] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const on = (it: (typeof items)[number]) => (it.href === "/" ? norm === "/" : norm.startsWith(it.href) || !!it.also?.some((a) => norm.startsWith(a)));
  const inMore = MORE.some((m) => norm.startsWith(m)) && !norm.startsWith("/interests/import/");
  const current = inMore ? "more" : (items.find((it) => !it.plus && on(it))?.href ?? "");
  const { ref, pos } = useSlider<HTMLElement>('[aria-current="page"]:not(.plus)', [current], "nav");
  return (
    <>
    <nav className="nav" aria-label="Main" ref={ref}>
      {pos && <span className="nav-pill" aria-hidden="true" style={{ left: pos.left, width: pos.width }} />}
      {items.map((it) => {
        const here = on(it);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={here ? "page" : undefined}
            className={[it.plus ? "plus" : "", tapped === it.href ? "tapped" : ""].join(" ").trim() || undefined}
            aria-label={it.plus ? "New thought" : undefined}
            onClick={() => setTapped(it.href)}
            onAnimationEnd={() => setTapped(null)}
            style={here && !it.plus ? { color: "var(--card)", fontWeight: 600 } : undefined}
          >
            {it.plus ? <Icon name="plus" size={24} width={2.6} /> : it.label}
          </Link>
        );
      })}
      <button
        aria-current={inMore ? "page" : undefined}
        aria-haspopup="dialog"
        aria-expanded={drawer}
        className={tapped === "more" ? "tapped" : undefined}
        onClick={() => (setTapped("more"), setDrawer(true))}
        onAnimationEnd={() => setTapped(null)}
        style={inMore ? { color: "var(--card)", fontWeight: 600 } : undefined}
      >
        More
      </button>
    </nav>
    {drawer && <Drawer onClose={() => setDrawer(false)} />}
    </>
  );
}
