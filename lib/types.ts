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
  /** the film, book, song or article this thought is pinned to */
  interest_id?: string | null;
  /** "letterboxd" or "goodreads" when it came in with an import */
  source?: string | null;
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

/* ---------- stage 2: interests, collections, inbox ---------- */

export type InterestKind = "film" | "book" | "music" | "article";
export type InterestStatus = "want" | "done";

export type InterestLink = { url: string; title: string; added_at: string };

export type Interest = {
  id: string;
  kind: InterestKind;
  title: string;
  /** director, author or artist */
  creator: string;
  year: number | null;
  /** poster, cover or picture; null until one is found */
  image_url: string | null;
  /** set once a picture was looked for, so it isn't searched again */
  image_checked: boolean;
  /** where the details came from: wikipedia, tmdb, openlibrary, musicbrainz, letterboxd, goodreads, link, manual */
  source: string;
  source_id: string | null;
  status: InterestStatus;
  /** 1 to 5, or null */
  rating: number | null;
  moods: string[];
  /** what kind of film, book or music it is; suggested ones or the person's own */
  genres: string[];
  favourite: boolean;
  links: InterestLink[];
  created_at: string;
  updated_at: string;
  /** when it was watched, read or heard */
  done_at: string | null;
  /** "Keep waiting" in Inbox pushes the next nudge back */
  nudged_at: string | null;
};

export type Collection = { id: string; title: string; note: string; created_at: string; updated_at: string };

/** one thing on a collection's shelf: an interest or a thought */
export type CollectionItem = { id: string; collection_id: string; interest_id: string | null; thought_id: string | null; added_at: string };

export type SavedLink = { id: string; url: string; title: string; note: string; created_at: string };

export const KIND_LABEL: Record<InterestKind, { one: string; many: string; want: string; done: string }> = {
  film: { one: "Film", many: "Films", want: "Want to watch", done: "Watched" },
  book: { one: "Book", many: "Books", want: "Want to read", done: "Read" },
  music: { one: "Music", many: "Music", want: "Want to listen", done: "Listened" },
  article: { one: "Article", many: "Articles", want: "To read", done: "Read" },
};
