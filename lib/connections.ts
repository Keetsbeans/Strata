import type { Collection, CollectionItem, Interest, Thought } from "./types";

/**
 * What an interest connects to, using only labels and links the person made themselves:
 * shared topics on pinned thoughts, shared collections and shared genres. Nothing reads the words.
 */
export function connectionsFor(item: Interest, interests: Interest[], thoughts: Thought[], collections: (Collection & { items: CollectionItem[] })[]) {
  const done = thoughts.filter((t) => t.finished);
  const low = (x: string) => x.trim().toLowerCase();
  const topics = new Set(done.filter((t) => t.interest_id === item.id).flatMap((t) => t.topics.map(low)));
  const myCollections = collections.filter((c) => c.items.some((x) => x.interest_id === item.id));
  const genres = new Set((item.genres ?? []).map(low));

  const reasons = new Map<string, string>();
  const note = (id: string, why: string) => !reasons.has(id) && reasons.set(id, why);
  for (const other of interests) {
    if (other.id === item.id) continue;
    const shared = done.filter((t) => t.interest_id === other.id).flatMap((t) => t.topics).find((x) => topics.has(low(x)));
    if (shared) note(other.id, `Shares the topic “${shared}”`);
    const col = myCollections.find((c) => c.items.some((x) => x.interest_id === other.id));
    if (col) note(other.id, `Both in “${col.title}”`);
    const g = (other.genres ?? []).find((x) => genres.has(low(x)));
    if (g && other.kind === item.kind) note(other.id, `Both ${g}`);
  }
  const items = interests.filter((i) => reasons.has(i.id)).slice(0, 8).map((i) => ({ item: i, why: reasons.get(i.id)! }));
  const related = done
    .filter((t) => t.interest_id !== item.id && t.topics.some((x) => topics.has(low(x))))
    .slice(0, 5)
    .map((t) => ({ thought: t, why: `“${t.topics.find((x) => topics.has(low(x)))}”` }));
  return { items, thoughts: related };
}
