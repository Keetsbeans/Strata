export type ThoughtKind = "card" | "page";

export type Thought = {
  id: string;
  body: string;
  kind: ThoughtKind;
  topics: string[];
  /** false while it is still a draft ("Unfinished") */
  finished: boolean;
  /** looked at in "Flip through" and kept without a topic */
  kept: boolean;
  thread_id: string | null;
  created_at: string;
  updated_at: string;
  /** set when moved to Discarded */
  discarded_at: string | null;
  /** how many earlier versions exist */
  version_count: number;
};

export type ThoughtVersion = { id: string; thought_id: string; body: string; created_at: string };

export type ThreadState = "ongoing" | "resting";

export type Thread = {
  id: string;
  title: string;
  state: ThreadState;
  created_at: string;
  discarded_at: string | null;
  /** thoughts that were let go when the thread was deleted with "keep the thoughts", so a restore can tie them back */
  released_ids: string[];
};

export const DISCARD_DAYS = 30;
