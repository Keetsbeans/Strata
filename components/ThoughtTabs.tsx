"use client";
import Link from "next/link";

/** the four chips at the top of Thoughts. All, Unsorted and Unfinished filter thoughts; Threads lists threads. */
export default function ThoughtTabs({ on, unsorted, unfinished }: { on: "all" | "unsorted" | "unfinished" | "threads"; unsorted?: number; unfinished?: number }) {
  const chip = (key: typeof on, label: string, href: string, n?: number) => (
    <Link href={href} className="chip" aria-pressed={on === key} style={{ display: "flex", flexDirection: "column", justifyContent: "center", textDecoration: "none" }} replace>
      {label}
      {n !== undefined && <span className="n">{n}</span>}
    </Link>
  );
  return (
    <div className="chips" role="tablist">
      {chip("all", "All", "/thoughts/")}
      {chip("unsorted", "Unsorted", "/thoughts/?filter=unsorted", unsorted)}
      {chip("unfinished", "Unfinished", "/thoughts/?filter=unfinished", unfinished)}
      {chip("threads", "Threads", "/threads/")}
    </div>
  );
}
