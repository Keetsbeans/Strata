import type { Thought, ThoughtVersion, Thread } from "@/lib/types";
import { DISCARD_DAYS } from "@/lib/types";
import type { NewThought, Store, ThoughtPatch } from "./types";
import { sampleData } from "./sample";

/** Try-out mode: everything lives in this browser only (localStorage). */
type DB = { thoughts: Thought[]; threads: Thread[]; versions: ThoughtVersion[] };
const KEY = "strata:try:v1";

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const now = () => new Date().toISOString();
const newestFirst = (a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at);

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const db = sampleData();
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
}
