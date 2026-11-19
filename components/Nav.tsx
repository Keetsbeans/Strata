"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

const items = [
  { href: "/", label: "Home" },
  { href: "/thoughts/", label: "Thoughts", also: ["/thought/", "/threads/", "/thread/", "/discarded/", "/review/"] },
  { href: "/new/", label: "New thought", plus: true, also: ["/write/"] },
  { href: "/collections/", label: "Collections", also: ["/interests/", "/interest/", "/collection/"] },
  { href: "/inbox/", label: "Inbox", also: ["/import/"] },
];

export default function Nav() {
  const path = usePathname() || "/";
  const norm = path.endsWith("/") ? path : path + "/";
  return (
    <nav className="nav" aria-label="Main">
      {items.map((it) => {
        const on = it.href === "/" ? norm === "/" : norm.startsWith(it.href) || it.also?.some((a) => norm.startsWith(a));
        return (
          <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined} className={it.plus ? "plus" : undefined} aria-label={it.plus ? "New thought" : undefined}>
            {it.plus ? <Icon name="plus" size={24} width={2.6} /> : it.label}
          </Link>
        );
      })}
    </nav>
  );
}
