import type { Thought, Thread, ThreadLink } from "@/lib/types";

const byDate = (a: Thought, b: Thought) => a.created_at.localeCompare(b.created_at);

/** the thought a thread grew from: its root_id, or for older threads the earliest thought in it */
export function rootOf(thread: Thread, thoughts: Thought[]): Thought | null {
  const inside = thoughts.filter((t) => t.thread_id === thread.id && !t.discarded_at);
  return inside.find((t) => t.id === thread.root_id) ?? [...inside].sort(byDate)[0] ?? null;
}

export type Entry = { thought: Thought; root?: boolean; link?: ThreadLink };

/** oldest first: the starting thought, then follow-ups and linked thoughts by the day they were written */
export function timeline(thread: Thread, thoughts: Thought[], links: ThreadLink[]): Entry[] {
  const root = rootOf(thread, thoughts);
  const byId = new Map(thoughts.map((t) => [t.id, t]));
  const rest: Entry[] = [
    ...thoughts.filter((t) => t.thread_id === thread.id && t.finished && t.id !== root?.id).map((thought) => ({ thought })),
    ...links
      .filter((l) => l.thread_id === thread.id && byId.has(l.thought_id))
      .map((link) => ({ thought: byId.get(link.thought_id)!, link })),
  ].sort((a, b) => byDate(a.thought, b.thought));
  return root ? [{ thought: root, root: true }, ...rest] : rest;
}

/** put a thought in a thread: a loose thought becomes a follow-up there; one already in a thread is linked instead */
export async function putInThread(store: import("@/lib/store/types").Store, t: Thought, threadId: string) {
  if (t.thread_id === threadId) return;
  if (!t.thread_id) await store.updateThought(t.id, { thread_id: threadId });
  else await store.linkToThreads(t.id, [threadId]);
}
