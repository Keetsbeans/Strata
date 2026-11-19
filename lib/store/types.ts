import type { Collection, CollectionItem, Interest, InterestKind, Thought, ThoughtKind, ThoughtVersion, Thread, ThreadState, SavedLink } from "@/lib/types";

export type NewThought = { body: string; kind: ThoughtKind; finished: boolean; topics?: string[]; thread_id?: string | null; interest_id?: string | null };
export type ThoughtPatch = Partial<Pick<Thought, "body" | "topics" | "finished" | "thread_id" | "kind" | "kept" | "interest_id">>;

export type NewInterest = Pick<Interest, "kind" | "title"> & Partial<Omit<Interest, "id" | "created_at" | "updated_at">>;
export type InterestPatch = Partial<Omit<Interest, "id" | "created_at" | "updated_at">>;

/** what an import brings in: items, plus reviews that become thoughts pinned to them */
export type ShelfImport = {
  source: "letterboxd" | "goodreads";
  items: (NewInterest & { key: string; added_at?: string })[];
  reviews: { key: string; body: string; written_at: string }[];
};
export type ImportResult = { added: number; updated: number; thoughts: number };

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

  // interests: films, books, music and articles
  interests(): Promise<Interest[]>; // newest first
  interest(id: string): Promise<Interest | null>;
  addInterest(i: NewInterest): Promise<Interest>;
  updateInterest(id: string, patch: InterestPatch): Promise<Interest>;
  /** removes the item; thoughts pinned to it stay, unpinned */
  deleteInterest(id: string): Promise<void>;
  importShelf(data: ShelfImport): Promise<ImportResult>;

  collections(): Promise<(Collection & { items: CollectionItem[] })[]>;
  collection(id: string): Promise<(Collection & { items: CollectionItem[] }) | null>;
  addCollection(title: string, note?: string): Promise<Collection>;
  updateCollection(id: string, patch: { title?: string; note?: string }): Promise<Collection>;
  deleteCollection(id: string): Promise<void>;
  addToCollection(collectionId: string, what: { interest_id?: string; thought_id?: string }): Promise<void>;
  removeFromCollection(itemId: string): Promise<void>;

  // Inbox: links saved to sort later
  links(): Promise<SavedLink[]>; // newest first
  addLink(l: { url: string; title?: string; note?: string }): Promise<SavedLink>;
  removeLink(id: string): Promise<void>;
  exportAll(): Promise<unknown>;
}
