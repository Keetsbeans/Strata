import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection, CollectionItem, Decor, ImportBatch, Interest, Placement, SavedLink, Thought, ThoughtVersion, Thread, ThreadLink } from "@/lib/types";
import type { ImportResult, InterestPatch, NewInterest, NewThought, ShelfImport, Store, ThoughtPatch } from "./types";
import { interestKey } from "@/lib/catalog/match";

/** Your real archive on Supabase. Row level security in the database makes sure only you can read or change your rows. */
export class CloudStore implements Store {
  readonly mode = "cloud" as const;
  constructor(private sb: SupabaseClient) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async ok<T>(p: PromiseLike<{ data: any; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(error.message);
    return data as T;
  }

  async thoughts() {
    return this.ok<Thought[]>(this.sb.from("thoughts").select("*").is("discarded_at", null).order("created_at", { ascending: false }));
  }
  async thought(id: string) {
    return this.ok<Thought | null>(this.sb.from("thoughts").select("*").eq("id", id).maybeSingle());
  }
  async versions(id: string) {
    return this.ok<ThoughtVersion[]>(this.sb.from("thought_versions").select("*").eq("thought_id", id).order("created_at", { ascending: false }));
  }
  async addThought(t: NewThought) {
    return this.ok<Thought>(
      this.sb.from("thoughts").insert({ body: t.body, kind: t.kind, finished: t.finished, topics: t.topics ?? [], thread_id: t.thread_id ?? null, interest_id: t.interest_id ?? null }).select().single()
    );
  }
  async updateThought(id: string, patch: ThoughtPatch) {
    // earlier versions are kept by a database trigger
    return this.ok<Thought>(this.sb.from("thoughts").update(patch).eq("id", id).select().single());
  }
  async discardThoughts(ids: string[]) {
    await this.ok(this.sb.from("thoughts").update({ discarded_at: new Date().toISOString() }).in("id", ids));
  }
  async restoreThoughts(ids: string[]) {
    await this.ok(this.sb.rpc("restore_thoughts", { ids }));
  }
  async deleteThoughtsForever(ids: string[]) {
    await this.ok(this.sb.from("thoughts").delete().in("id", ids));
  }

  async threads() {
    return this.ok<Thread[]>(this.sb.from("threads").select("*").is("discarded_at", null).order("created_at", { ascending: false }));
  }
  async thread(id: string) {
    return this.ok<Thread | null>(this.sb.from("threads").select("*").eq("id", id).maybeSingle());
  }
  async addThread(title: string) {
    return this.ok<Thread>(this.sb.from("threads").insert({ title }).select().single());
  }
  async updateThread(id: string, patch: { title?: string; state?: Thread["state"]; note?: string }) {
    return this.ok<Thread>(this.sb.from("threads").update(patch).eq("id", id).select().single());
  }
  async startThread(thoughtId: string, title: string, note = "") {
    const t = await this.ok<Thread>(this.sb.from("threads").insert({ title, note, root_id: thoughtId }).select().single());
    await this.ok(this.sb.from("thoughts").update({ thread_id: t.id }).eq("id", thoughtId));
    return t;
  }
  async threadLinks() {
    return this.ok<ThreadLink[]>(this.sb.from("thread_links").select("*, threads!inner(discarded_at)").is("threads.discarded_at", null).then((r) => ({
      ...r,
      data: (r.data ?? []).map(({ threads: _t, ...x }: ThreadLink & { threads?: unknown }) => x),
    })));
  }
  async linkToThreads(thoughtId: string, threadIds: string[]) {
    if (!threadIds.length) return;
    const { error } = await this.sb.from("thread_links").upsert(threadIds.map((thread_id) => ({ thread_id, thought_id: thoughtId })), { onConflict: "thread_id,thought_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  async unlink(linkId: string) {
    await this.ok(this.sb.from("thread_links").delete().eq("id", linkId));
  }
  async discardThread(id: string, keepThoughts: boolean) {
    await this.ok(this.sb.rpc("discard_thread", { thread: id, keep_thoughts: keepThoughts }));
  }
  async restoreThreads(ids: string[]) {
    await this.ok(this.sb.rpc("restore_threads", { ids }));
  }
  async deleteThreadsForever(ids: string[]) {
    await this.ok(this.sb.rpc("delete_threads_forever", { ids }));
  }
  async discarded() {
    const [thoughts, threads] = await Promise.all([
      this.ok<Thought[]>(this.sb.from("discarded_thoughts").select("*").order("discarded_at", { ascending: false })),
      this.ok<(Thread & { count: number })[]>(this.sb.from("discarded_threads").select("*").order("discarded_at", { ascending: false })),
    ]);
    return { thoughts, threads };
  }
  async purge() {
    await this.ok(this.sb.rpc("purge_discarded"));
  }
  async search(q: string) {
    const words = q.trim().split(/\s+/).filter(Boolean).slice(0, 8);
    if (!words.length) return [];
    let query = this.sb.from("thoughts").select("*").is("discarded_at", null);
    for (const w of words) {
      const safe = w.replace(/[%_,()\\]/g, "");
      if (safe) query = query.ilike("search_text", `%${safe}%`);
    }
    return this.ok<Thought[]>(query.order("created_at", { ascending: false }).limit(100));
  }
  async exportAll() {
    const [thoughts, threads, versions, interests, collections, collectionItems, links, threadLinks, imports] = await Promise.all([
      this.ok<Thought[]>(this.sb.from("thoughts").select("*")),
      this.ok<Thread[]>(this.sb.from("threads").select("*")),
      this.ok<ThoughtVersion[]>(this.sb.from("thought_versions").select("*")),
      this.ok<Interest[]>(this.sb.from("interests").select("*")),
      this.ok<Collection[]>(this.sb.from("collections").select("*")),
      this.ok<CollectionItem[]>(this.sb.from("collection_items").select("*")),
      this.ok<SavedLink[]>(this.sb.from("saved_links").select("*")),
      this.ok<ThreadLink[]>(this.sb.from("thread_links").select("*")),
      this.ok<ImportBatch[]>(this.sb.from("imports").select("*")),
    ]);
    return { exported_at: new Date().toISOString(), thoughts, threads, versions, interests, collections, collectionItems, links, threadLinks, imports };
  }

  // ---------- interests ----------
  async interests() {
    return this.ok<Interest[]>(this.sb.from("interests").select("*").order("created_at", { ascending: false }));
  }
  async interest(id: string) {
    return this.ok<Interest | null>(this.sb.from("interests").select("*").eq("id", id).maybeSingle());
  }
  async addInterest(i: NewInterest) {
    return this.ok<Interest>(this.sb.from("interests").insert(i).select().single());
  }
  async updateInterest(id: string, patch: InterestPatch) {
    return this.ok<Interest>(this.sb.from("interests").update(patch).eq("id", id).select().single());
  }
  async deleteInterest(id: string) {
    await this.ok(this.sb.from("interests").delete().eq("id", id));
  }
  async importShelf(data: ShelfImport): Promise<ImportResult> {
    const res: ImportResult = { added: 0, updated: 0, thoughts: 0 };
    const batch = await this.ok<ImportBatch>(this.sb.from("imports").insert({ source: data.source, count: 0 }).select().single());
    const existing = await this.interests();
    const byKey = new Map(existing.map((x) => [interestKey(x), x]));
    const ids = new Map<string, string>();
    const fresh: (NewInterest & { created_at?: string })[] = [];
    const freshKeys: string[] = [];
    for (const { key, added_at, ...item } of data.items) {
      const found = byKey.get(interestKey(item)) ?? byKey.get(interestKey({ ...item, year: null }));
      if (found) {
        ids.set(key, found.id);
        const patch: InterestPatch = {};
        if (item.status === "done" && found.status !== "done") Object.assign(patch, { status: "done", done_at: item.done_at ?? found.done_at });
        if (item.rating && !found.rating) patch.rating = item.rating;
        if (Object.keys(patch).length) await this.updateInterest(found.id, patch);
        res.updated++;
      } else {
        fresh.push({ ...item, created_at: added_at, import_id: batch.id });
        freshKeys.push(key);
      }
    }
    // in batches, so a big shelf doesn't time out
    for (let i = 0; i < fresh.length; i += 200) {
      const rows = await this.ok<Interest[]>(this.sb.from("interests").insert(fresh.slice(i, i + 200)).select("id"));
      rows.forEach((r, j) => ids.set(freshKeys[i + j], r.id));
      res.added += rows.length;
    }
    const already = await this.ok<{ interest_id: string; created_at: string }[]>(
      this.sb.from("thoughts").select("interest_id, created_at").eq("source", data.source)
    );
    const seen = new Set(already.map((t) => t.interest_id + "|" + new Date(t.created_at).getTime()));
    const reviews = data.reviews
      .map((r) => ({ interest_id: ids.get(r.key), body: r.body.trim(), created_at: r.written_at }))
      .filter((r) => r.interest_id && r.body && !seen.has(r.interest_id + "|" + new Date(r.created_at).getTime()))
      .map((r) => ({ ...r, kind: r.body.length > 320 ? "page" : "card", finished: true, kept: true, source: data.source }));
    for (let i = 0; i < reviews.length; i += 200) {
      await this.ok(this.sb.from("thoughts").insert(reviews.slice(i, i + 200)));
    }
    res.thoughts = reviews.length;
    if (res.added) {
      await this.ok(this.sb.from("imports").update({ count: res.added }).eq("id", batch.id));
      res.batch = batch.id;
    } else await this.ok(this.sb.from("imports").delete().eq("id", batch.id));
    return res;
  }

  // ---------- collections ----------
  async collections() {
    const [cols, items] = await Promise.all([
      this.ok<Collection[]>(this.sb.from("collections").select("*").order("updated_at", { ascending: false })),
      this.ok<CollectionItem[]>(this.sb.from("collection_items").select("*").order("added_at", { ascending: true })),
    ]);
    return cols.map((c) => ({ ...c, items: items.filter((x) => x.collection_id === c.id && x.interest_id) }));
  }
  async collection(id: string) {
    const [c, items] = await Promise.all([
      this.ok<Collection | null>(this.sb.from("collections").select("*").eq("id", id).maybeSingle()),
      this.ok<CollectionItem[]>(this.sb.from("collection_items").select("*").eq("collection_id", id).order("added_at", { ascending: true })),
    ]);
    return c ? { ...c, items: items.filter((x) => x.interest_id) } : null;
  }
  async addCollection(title: string, note = "") {
    return this.ok<Collection>(this.sb.from("collections").insert({ title, note }).select().single());
  }
  async updateCollection(id: string, patch: { title?: string; note?: string; cover_id?: string | null; decor?: Decor[] }) {
    return this.ok<Collection>(this.sb.from("collections").update(patch).eq("id", id).select().single());
  }
  async deleteCollection(id: string) {
    await this.ok(this.sb.from("collections").delete().eq("id", id));
  }
  async addToCollection(collectionId: string, what: { interest_id: string }) {
    const { error } = await this.sb.from("collection_items").insert({ collection_id: collectionId, interest_id: what.interest_id });
    if (error && error.code !== "23505") throw new Error(error.message); // 23505: it is already there
  }
  async removeFromCollection(itemId: string) {
    await this.ok(this.sb.from("collection_items").delete().eq("id", itemId));
  }
  async placeItem(itemId: string, at: Placement) {
    await this.ok(this.sb.from("collection_items").update(at).eq("id", itemId));
  }
  async imports() {
    return this.ok<ImportBatch[]>(this.sb.from("imports").select("*").order("created_at", { ascending: false }));
  }
  async finishImport(id: string) {
    await this.ok(this.sb.from("imports").update({ done_at: new Date().toISOString() }).eq("id", id));
  }

  // ---------- links to sort ----------
  async links() {
    return this.ok<SavedLink[]>(this.sb.from("saved_links").select("*").order("created_at", { ascending: false }));
  }
  async addLink(l: { url: string; title?: string; note?: string }) {
    return this.ok<SavedLink>(this.sb.from("saved_links").insert({ url: l.url, title: l.title ?? "", note: l.note ?? "" }).select().single());
  }
  async removeLink(id: string) {
    await this.ok(this.sb.from("saved_links").delete().eq("id", id));
  }
}
