"use client";
import Link from "next/link";

/** the tabs at the top of Thoughts: All, Unsorted and Unfinished filter thoughts; Threads lists threads. Underlined, so they never look like buttons. */
export default function ThoughtTabs({ on, unsorted, unfinished }: { on: "all" | "unsorted" | "unfinished" | "threads"; unsorted?: number; unfinished?: number }) {
  const tab = (key: typeof on, label: string, href: string, n?: number) => (
    <Link href={href} className="tab" role="tab" aria-selected={on === key} aria-current={on === key ? "page" : undefined} replace>
      {label}
      {!!n && <span className="tab-n">{n}</span>}
    </Link>
  );
  return (
    <nav className="tabs" role="tablist" aria-label="Show">
      {tab("all", "All", "/thoughts/")}
      {tab("unsorted", "Unsorted", "/thoughts/?filter=unsorted", unsorted)}
      {tab("unfinished", "Unfinished", "/thoughts/?filter=unfinished", unfinished)}
      {tab("threads", "Threads", "/threads/")}
    </nav>
  );
}
