import type { Interest } from "./types";
import { KIND_LABEL } from "./types";

/** "Watched · 2 thoughts" */
export function caption(it: Interest, pinned: number) {
  const L = KIND_LABEL[it.kind];
  const s = it.status === "done" ? L.done : L.want;
  return pinned ? `${s} · ${pinned} ${pinned === 1 ? "thought" : "thoughts"}` : s;
}

/** "Wim Wenders · 2023 · Film" */
export function details(it: Pick<Interest, "creator" | "year" | "kind">, label?: string) {
  return [it.creator, it.year, label ?? KIND_LABEL[it.kind].one].filter(Boolean).join(" · ");
}
