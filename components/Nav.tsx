"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

const items = [
  { href: "/", label: "Home" },
  { href: "/thoughts/", label: "Thoughts", also: ["/thought/", "/threads/", "/thread/", "/discarded/", "/review/"] },
  { href: "/search/", label: "Search", search: true },
  { href: "/interests/", label: "Interests", also: ["/interest/", "/collections/", "/collection/"] },
  { href: "/inbox/", label: "Inbox" },
];

export default function Nav() {
  const path = usePathname() || "/";
  const norm = path.endsWith("/") ? path : path + "/";
  return (
    <nav className="nav" aria-label="Main">
      {items.map((it) => {
        const on = it.href === "/" ? norm === "/" : norm.startsWith(it.href) || it.also?.some((a) => norm.startsWith(a));
        return (
          <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined} className={it.search ? "search" : undefined} aria-label={it.search ? "Search" : undefined}>
            {it.search ? <Icon name="search" size={20} width={2.4} /> : it.label}
          </Link>
        );
      })}
    </nav>
  );
}
