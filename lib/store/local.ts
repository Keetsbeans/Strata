import type { Collection, CollectionItem, Interest, SavedLink, Thought, ThoughtVersion, Thread } from "@/lib/types";
import { DISCARD_DAYS } from "@/lib/types";
import type { ImportResult, InterestPatch, NewInterest, NewThought, ShelfImport, Store, ThoughtPatch } from "./types";
import { sampleData } from "./sample";
import { isGuest } from "../guest";
import { interestKey } from "@/lib/catalog/match";

/** Try-out mode: everything lives in this browser only (localStorage). */
type DB = {
  thoughts: Thought[];
  threads: Thread[];
  versions: ThoughtVersion[];
  interests: Interest[];
  collections: Collection[];
  collectionItems: CollectionItem[];
  links: SavedLink[];
};
const KEY = "strata:try:v1";

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const now = () => new Date().toISOString();
const newestFirst = (a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at);

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    // try-outs started before stage 2 have no interests, collections or links yet
    if (raw) {
      const db = { interests: [], collections: [], collectionItems: [], links: [], ...JSON.parse(raw) };
      db.interests = db.interests.map((i: Interest) => ({ ...i, genres: i.genres ?? [] }));
      return db;
    }
  } catch {}
  const db = sampleData();
  // people arriving through the opening screens start with a clean slate and write their own first thought
  if (isGuest()) for (const k of Object.keys(db) as (keyof DB)[]) if (Array.isArray(db[k])) (db[k] as unknown[]) = [];
  save(db);
  return db;
}
function save(db: DB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {}
}

export function clearLocal() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function newInterest(i: NewInterest, id: string, at: string): Interest {
  return {
    creator: "",
    year: null,
    image_url: null,
    image_checked: false,
    source: "manual",
    source_id: null,
    status: "want",
    rating: null,
    moods: [],
    genres: [],
    favourite: false,
    links: [],
    done_at: null,
    nudged_at: null,
    ...i,
    id,
    created_at: at,
    updated_at: at,
  };
}

export class LocalStore implements Store {
  readonly mode = "local" as const;
  private db: DB = load();
  private write() {
    save(this.db);
  }

  async thoughts() {
    return this.db.thoughts.filter((t) => !t.discarded_at).sort(newestFirst);
  }
  async thought(id: string) {
    return this.db.thoughts.find((t) => t.id === id) ?? null;
  }
  async versions(id: string) {
    return this.db.versions.filter((v) => v.thought_id === id).sort(newestFirst);
  }
  async addThought(t: NewThought) {
    const th: Thought = {
      id: uid(),
      body: t.body,
      kind: t.kind,
      finished: t.finished,
      kept: false,
      topics: t.topics ?? [],
      thread_id: t.thread_id ?? null,
      interest_id: t.interest_id ?? null,
      source: null,
      created_at: now(),
      updated_at: now(),
      discarded_at: null,
      version_count: 0,
    };
    this.db.thoughts.push(th);
    this.write();
    return th;
  }
  async updateThought(id: string, patch: ThoughtPatch) {
    const th = this.db.thoughts.find((t) => t.id === id);
    if (!th) throw new Error("That thought no longer exists.");
    // keep the old wording when a finished thought's text changes
    if (patch.body !== undefined && patch.body !== th.body && th.finished) {
      this.db.versions.push({ id: uid(), thought_id: id, body: th.body, created_at: th.updated_at });
      th.version_count += 1;
    }
    Object.assign(th, patch, { updated_at: now() });
    this.write();
    return th;
  }
  async discardThoughts(ids: string[]) {
    const at = now();
    for (const t of this.db.thoughts) if (ids.includes(t.id)) t.discarded_at = at;
    this.write();
  }
  async restoreThoughts(ids: string[]) {
    for (const t of this.db.thoughts) {
      if (!ids.includes(t.id)) continue;
      t.discarded_at = null;
      // its thread may be gone; then it just returns to the list
      const thr = this.db.threads.find((x) => x.id === t.thread_id);
      if (thr && thr.discarded_at) t.thread_id = null;
    }
    this.write();
  }
  async deleteThoughtsForever(ids: string[]) {
    this.db.thoughts = this.db.thoughts.filter((t) => !ids.includes(t.id));
    this.db.versions = this.db.versions.filter((v) => !ids.includes(v.thought_id));
    this.db.collectionItems = this.db.collectionItems.filter((x) => !x.thought_id || !ids.includes(x.thought_id));
    this.write();
  }

  async threads() {
    return this.db.threads.filter((t) => !t.discarded_at).sort(newestFirst);
  }
  async thread(id: string) {
    return this.db.threads.find((t) => t.id === id) ?? null;
  }
  async addThread(title: string) {
    const t: Thread = { id: uid(), title, state: "ongoing", created_at: now(), discarded_at: null, released_ids: [] };
    this.db.threads.push(t);
    this.write();
    return t;
  }
  async updateThread(id: string, patch: { title?: string; state?: Thread["state"] }) {
    const t = this.db.threads.find((x) => x.id === id);
    if (!t) throw new Error("That thread no longer exists.");
    Object.assign(t, patch);
    this.write();
    return t;
  }
  async discardThread(id: string, keepThoughts: boolean) {
    const t = this.db.threads.find((x) => x.id === id);
    if (!t) return;
    const at = now();
    t.discarded_at = at;
    const inside = this.db.thoughts.filter((x) => x.thread_id === id && !x.discarded_at);
    if (keepThoughts) {
      t.released_ids = inside.map((x) => x.id);
      inside.forEach((x) => (x.thread_id = null));
    } else {
      t.released_ids = [];
      inside.forEach((x) => (x.discarded_at = at));
    }
    this.write();
  }
  async restoreThreads(ids: string[]) {
    for (const t of this.db.threads) {
      if (!ids.includes(t.id) || !t.discarded_at) continue;
      for (const x of this.db.thoughts) {
        if (x.thread_id === t.id && x.discarded_at === t.discarded_at) x.discarded_at = null;
        if (t.released_ids.includes(x.id) && !x.thread_id) x.thread_id = t.id;
      }
      t.discarded_at = null;
      t.released_ids = [];
    }
    this.write();
  }
  async deleteThreadsForever(ids: string[]) {
    const gone = this.db.thoughts.filter((x) => x.thread_id && ids.includes(x.thread_id) && x.discarded_at).map((x) => x.id);
    await this.deleteThoughtsForever(gone);
    this.db.threads = this.db.threads.filter((t) => !ids.includes(t.id));
    for (const x of this.db.thoughts) if (x.thread_id && ids.includes(x.thread_id)) x.thread_id = null;
    this.write();
  }

  async discarded() {
    const thr = this.db.threads.filter((t) => t.discarded_at);
    const inThread = (x: Thought) => thr.some((t) => t.id === x.thread_id && t.discarded_at === x.discarded_at);
    return {
      thoughts: this.db.thoughts.filter((x) => x.discarded_at && !inThread(x)).sort((a, b) => b.discarded_at!.localeCompare(a.discarded_at!)),
      threads: thr
        .map((t) => ({ ...t, count: t.released_ids.length + this.db.thoughts.filter((x) => x.thread_id === t.id && x.discarded_at === t.discarded_at).length }))
        .sort((a, b) => b.discarded_at!.localeCompare(a.discarded_at!)),
    };
  }
  async purge() {
    const cutoff = new Date(Date.now() - DISCARD_DAYS * 86400000).toISOString();
    const oldThreads = this.db.threads.filter((t) => t.discarded_at && t.discarded_at < cutoff).map((t) => t.id);
    if (oldThreads.length) await this.deleteThreadsForever(oldThreads);
    const oldThoughts = this.db.thoughts.filter((t) => t.discarded_at && t.discarded_at < cutoff).map((t) => t.id);
    if (oldThoughts.length) await this.deleteThoughtsForever(oldThoughts);
  }
  async search(q: string) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const list = await this.thoughts();
    return list.filter((t) => {
      const hay = (t.body + " " + t.topics.join(" ")).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  async exportAll() {
    return { exported_at: now(), ...this.db };
  }

  // ---------- interests ----------
  async interests() {
    return [...this.db.interests].sort(newestFirst);
  }
  async interest(id: string) {
    return this.db.interests.find((x) => x.id === id) ?? null;
  }
  async addInterest(i: NewInterest) {
    const it = newInterest(i, uid(), now());
    this.db.interests.push(it);
    this.write();
    return it;
  }
  async updateInterest(id: string, patch: InterestPatch) {
    const it = this.db.interests.find((x) => x.id === id);
    if (!it) throw new Error("That item no longer exists.");
    Object.assign(it, patch, { updated_at: now() });
    this.write();
    return it;
  }
  async deleteInterest(id: string) {
    this.db.interests = this.db.interests.filter((x) => x.id !== id);
    this.db.collectionItems = this.db.collectionItems.filter((x) => x.interest_id !== id);
    for (const t of this.db.thoughts) if (t.interest_id === id) t.interest_id = null;
    this.write();
  }
  async importShelf(data: ShelfImport): Promise<ImportResult> {
    const res: ImportResult = { added: 0, updated: 0, thoughts: 0 };
    const byKey = new Map(this.db.interests.map((x) => [interestKey(x), x]));
    const ids = new Map<string, string>();
    for (const { key, added_at, ...item } of data.items) {
      const found = byKey.get(interestKey(item)) ?? byKey.get(interestKey({ ...item, year: null }));
      if (found) {
        // a watched film stays watched; a new rating fills an empty one
        if (item.status === "done" && found.status !== "done") Object.assign(found, { status: "done", done_at: item.done_at ?? found.done_at });
        if (item.rating && !found.rating) found.rating = item.rating;
        found.updated_at = now();
        ids.set(key, found.id);
        res.updated++;
      } else {
        const it = newInterest(item, uid(), added_at && added_at < now() ? added_at : now());
        this.db.interests.push(it);
        byKey.set(interestKey(it), it);
        ids.set(key, it.id);
        res.added++;
      }
    }
    for (const r of data.reviews) {
      const interest_id = ids.get(r.key);
      if (!interest_id || !r.body.trim()) continue;
      const at = r.written_at < now() ? r.written_at : now();
      if (this.db.thoughts.some((t) => t.interest_id === interest_id && t.source === data.source && t.created_at === at)) continue;
      this.db.thoughts.push({
        id: uid(), body: r.body.trim(), kind: r.body.length > 320 ? "page" : "card", topics: [], finished: true, kept: true,
        thread_id: null, interest_id, source: data.source, created_at: at, updated_at: at, discarded_at: null, version_count: 0,
      });
      res.thoughts++;
    }
    this.write();
    return res;
  }

  // ---------- collections ----------
  private withItems(c: Collection) {
    return { ...c, items: this.db.collectionItems.filter((x) => x.collection_id === c.id).sort((a, b) => a.added_at.localeCompare(b.added_at)) };
  }
  async collections() {
    return [...this.db.collections].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map((c) => this.withItems(c));
  }
  async collection(id: string) {
    const c = this.db.collections.find((x) => x.id === id);
    return c ? this.withItems(c) : null;
  }
  async addCollection(title: string, note = "") {
    const c: Collection = { id: uid(), title, note, created_at: now(), updated_at: now() };
    this.db.collections.push(c);
    this.write();
    return c;
  }
  async updateCollection(id: string, patch: { title?: string; note?: string }) {
    const c = this.db.collections.find((x) => x.id === id);
    if (!c) throw new Error("That collection no longer exists.");
    Object.assign(c, patch, { updated_at: now() });
    this.write();
    return c;
  }
  async deleteCollection(id: string) {
    this.db.collections = this.db.collections.filter((x) => x.id !== id);
    this.db.collectionItems = this.db.collectionItems.filter((x) => x.collection_id !== id);
    this.write();
  }
  async addToCollection(collectionId: string, what: { interest_id?: string; thought_id?: string }) {
    const items = this.db.collectionItems.filter((x) => x.collection_id === collectionId);
    if (items.some((x) => (what.interest_id && x.interest_id === what.interest_id) || (what.thought_id && x.thought_id === what.thought_id))) return;
    this.db.collectionItems.push({ id: uid(), collection_id: collectionId, interest_id: what.interest_id ?? null, thought_id: what.thought_id ?? null, added_at: now() });
    const c = this.db.collections.find((x) => x.id === collectionId);
    if (c) c.updated_at = now();
    this.write();
  }
  async removeFromCollection(itemId: string) {
    this.db.collectionItems = this.db.collectionItems.filter((x) => x.id !== itemId);
    this.write();
  }

  // ---------- links to sort ----------
  async links() {
    return [...this.db.links].sort(newestFirst);
  }
  async addLink(l: { url: string; title?: string; note?: string }) {
    const link: SavedLink = { id: uid(), url: l.url, title: l.title ?? "", note: l.note ?? "", created_at: now() };
    this.db.links.push(link);
    this.write();
    return link;
  }
  async removeLink(id: string) {
    this.db.links = this.db.links.filter((x) => x.id !== id);
    this.write();
  }
}
