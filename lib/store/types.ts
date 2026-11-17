import type { Thought, ThoughtKind, ThoughtVersion, Thread, ThreadState } from "@/lib/types";

export type NewThought = { body: string; kind: ThoughtKind; finished: boolean; topics?: string[]; thread_id?: string | null };
export type ThoughtPatch = Partial<Pick<Thought, "body" | "topics" | "finished" | "thread_id" | "kind" | "kept">>;

/** Everything the screens need. Two versions exist: one in this browser only (try-out mode) and one on Supabase. */
export interface Store {
  readonly mode: "local" | "cloud";
  thoughts(): Promise<Thought[]>; // not discarded, newest first
  thought(id: string): Promise<Thought | null>;
  versions(id: string): Promise<ThoughtVersion[]>;
  addThought(t: NewThought): Promise<Thought>;
  updateThought(id: string, patch: ThoughtPatch): Promise<Thought>;
  discardThoughts(ids: string[]): Promise<void>;
  restoreThoughts(ids: string[]): Promise<void>;
  deleteThoughtsForever(ids: string[]): Promise<void>;

  threads(): Promise<Thread[]>; // not discarded
  thread(id: string): Promise<Thread | null>;
  addThread(title: string): Promise<Thread>;
  updateThread(id: string, patch: { title?: string; state?: ThreadState }): Promise<Thread>;
  /** keepThoughts: the thoughts leave the thread and stay in the list. Otherwise they go to Discarded with it. */
  discardThread(id: string, keepThoughts: boolean): Promise<void>;
  restoreThreads(ids: string[]): Promise<void>;
  deleteThreadsForever(ids: string[]): Promise<void>;

  discarded(): Promise<{ thoughts: Thought[]; threads: (Thread & { count: number })[] }>;
  /** removes anything discarded more than 30 days ago */
  purge(): Promise<void>;
  search(q: string): Promise<Thought[]>;
  exportAll(): Promise<unknown>;
}
