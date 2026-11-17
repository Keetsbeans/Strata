import type { SupabaseClient } from "@supabase/supabase-js";
import type { Thought, ThoughtVersion, Thread } from "@/lib/types";
import type { NewThought, Store, ThoughtPatch } from "./types";

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
      this.sb.from("thoughts").insert({ body: t.body, kind: t.kind, finished: t.finished, topics: t.topics ?? [], thread_id: t.thread_id ?? null }).select().single()
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
  async updateThread(id: string, patch: { title?: string; state?: Thread["state"] }) {
    return this.ok<Thread>(this.sb.from("threads").update(patch).eq("id", id).select().single());
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
    const [thoughts, threads, versions] = await Promise.all([
      this.ok<Thought[]>(this.sb.from("thoughts").select("*")),
      this.ok<Thread[]>(this.sb.from("threads").select("*")),
      this.ok<ThoughtVersion[]>(this.sb.from("thought_versions").select("*")),
    ]);
    return { exported_at: new Date().toISOString(), thoughts, threads, versions };
  }
}
