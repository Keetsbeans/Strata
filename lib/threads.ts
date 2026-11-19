import type { Thought, Thread, ThreadLink } from "@/lib/types";

const byDate = (a: Thought, b: Thought) => a.created_at.localeCompare(b.created_at);

/** the thought a thread grew from: its root_id, or for older threads the earliest thought in it */
export function rootOf(thread: Thread, thoughts: Thought[]): Thought | null {
  const inside = thoughts.filter((t) => t.thread_id === thread.id && !t.discarded_at);
  return inside.find((t) => t.id === thread.root_id) ?? [...inside].sort(byDate)[0] ?? null;
}

/** under: the thought in the thread this linked thought hangs under */
export type Entry = { thought: Thought; root?: boolean; link?: ThreadLink; under?: Thought };

/**
 * Oldest first: the starting thought, then follow-ups and linked thoughts by the day they were written.
 * A thought linked under a particular thought comes straight after it.
 */
export function timeline(thread: Thread, thoughts: Thought[], links: ThreadLink[]): Entry[] {
  const root = rootOf(thread, thoughts);
  const byId = new Map(thoughts.map((t) => [t.id, t]));
  const own = thoughts.filter((t) => t.thread_id === thread.id && t.finished && t.id !== root?.id);
  const mine = links.filter((l) => l.thread_id === thread.id && byId.has(l.thought_id));
  const shown = new Set([...(root ? [root.id] : []), ...own.map((t) => t.id), ...mine.map((l) => l.thought_id)]);
  const hangs = (l: ThreadLink) => !!l.under_id && l.under_id !== l.thought_id && shown.has(l.under_id);
  const rest: Entry[] = [
    ...own.map((thought) => ({ thought })),
    ...mine.filter((l) => !hangs(l)).map((link) => ({ thought: byId.get(link.thought_id)!, link })),
  ].sort((a, b) => byDate(a.thought, b.thought));
  const out: Entry[] = [];
  const done = new Set<string>();
  const add = (e: Entry) => {
    if (done.has(e.thought.id)) return;
    done.add(e.thought.id);
    out.push(e);
    mine
      .filter((l) => hangs(l) && l.under_id === e.thought.id)
      .map((link) => ({ thought: byId.get(link.thought_id)!, link, under: e.thought }))
      .sort((a, b) => byDate(a.thought, b.thought))
      .forEach(add);
  };
  if (root) add({ thought: root, root: true });
  rest.forEach(add);
  return out;
}

/** put a thought in a thread: a loose thought becomes a follow-up there; one already in a thread is linked instead */
export async function putInThread(store: import("@/lib/store/types").Store, t: Thought, threadId: string) {
  if (t.thread_id === threadId) return;
  if (!t.thread_id) await store.updateThought(t.id, { thread_id: threadId });
  else await store.linkToThreads(t.id, [threadId]);
}
