import type { WordLink } from "@/lib/types";

export type Piece = { text: string; link?: WordLink };

/** split a thought into plain text and linked words. Each link marks the first place its words appear. */
export function splitLinks(body: string, links: WordLink[] = []): Piece[] {
  const spans: { at: number; end: number; link: WordLink }[] = [];
  for (const link of links) {
    if (!link.text) continue;
    const at = body.indexOf(link.text);
    if (at < 0) continue;
    const end = at + link.text.length;
    if (spans.some((s) => at < s.end && end > s.at)) continue; // overlaps an earlier link
    spans.push({ at, end, link });
  }
  spans.sort((a, b) => a.at - b.at);
  const out: Piece[] = [];
  let i = 0;
  for (const s of spans) {
    if (s.at > i) out.push({ text: body.slice(i, s.at) });
    out.push({ text: body.slice(s.at, s.end), link: s.link });
    i = s.end;
  }
  if (i < body.length) out.push({ text: body.slice(i) });
  return out;
}

/** the chosen text, without spaces or punctuation hanging off either end */
export function cleanPick(s: string) {
  return s.replace(/^[\s"'“”‘’.,;:!?()\-–—]+|[\s"'“”‘’.,;:!?()\-–—]+$/g, "").replace(/\s+/g, " ");
}
