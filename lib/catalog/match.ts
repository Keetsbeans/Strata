import type { InterestKind } from "@/lib/types";

/** "The Remains of the Day" and "remains of the day, the" count as the same title */
export function normTitle(t: string) {
  return t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^(the|a|an) /, "")
    .replace(/ (the|a|an)$/, "")
    .trim();
}

/** the same film, book or album: same kind, same title, same year (when both have one) */
export function interestKey(i: { kind: InterestKind; title: string; year?: number | null }) {
  return `${i.kind}|${normTitle(i.title)}|${i.year ?? ""}`;
}
