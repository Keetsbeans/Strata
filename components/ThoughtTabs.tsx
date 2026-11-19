"use client";
import Link from "next/link";
import { useSlider } from "@/lib/slide";

/** the tabs on Thoughts: All, Unsorted, Unfinished (Threads has its own place in the bottom bar). Underlined, with the line sliding to the one you pick. */
export default function ThoughtTabs({ on, unsorted, unfinished }: { on: "all" | "unsorted" | "unfinished" | "threads"; unsorted?: number; unfinished?: number }) {
  const { ref, pos } = useSlider<HTMLElement>('[aria-selected="true"]', [on], "ttabs");
  const tab = (key: typeof on, label: string, href: string, n?: number) => (
    <Link href={href} className="ttab" role="tab" aria-selected={on === key} aria-current={on === key ? "page" : undefined} replace scroll={false}>
      {label}
      {!!n && <span className="ttab-n">{n}</span>}
    </Link>
  );
  return (
    <nav className="ttabs" role="tablist" aria-label="Show" ref={ref}>
      {tab("all", "All", "/thoughts/")}
      {tab("unsorted", "Unsorted", "/thoughts/?filter=unsorted", unsorted)}
      {tab("unfinished", "Unfinished", "/thoughts/?filter=unfinished", unfinished)}
      {pos && <span className="ttabs-line" aria-hidden="true" style={{ left: pos.left, width: pos.width }} />}
    </nav>
  );
}
