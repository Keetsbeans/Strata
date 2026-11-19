import { zipSync, strToU8 } from "fflate";
import type { Thought, Thread, ThoughtVersion } from "./types";

type Data = { exported_at: string; thoughts: Thought[]; threads: Thread[]; versions: ThoughtVersion[] };

const pad = (n: number) => String(n).padStart(2, "0");
function stamp(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function slug(text: string, max = 40) {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/, "");
  return s || "thought";
}

/**
 * Everything as plain text files anyone can open: one Markdown file per thought (with its earlier
 * versions underneath), one file per thread listing its thoughts in order, and a README.
 * The full technical copy (strata-data.json) is included too, so nothing is lost.
 */
export function plainTextZip(data: Data): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const threadTitle = new Map(data.threads.map((t) => [t.id, t.title]));
  const names = new Map<string, string>();
  const used = new Set<string>();
  const sorted = [...data.thoughts].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const t of sorted) {
    const folder = t.discarded_at ? "discarded" : "thoughts";
    let name = `${stamp(t.created_at).replace(/[ :]/g, "-")}-${slug(t.body)}`;
    while (used.has(folder + name)) name += "-2";
    used.add(folder + name);
    names.set(t.id, `${folder}/${name}.md`);
    const meta = [
      `Written: ${stamp(t.created_at)}`,
      t.updated_at !== t.created_at ? `Last changed: ${stamp(t.updated_at)}` : "",
      t.topics.length ? `Topics: ${t.topics.join(", ")}` : "",
      t.thread_id && threadTitle.get(t.thread_id) ? `Thread: ${threadTitle.get(t.thread_id)}` : "",
      t.finished ? "" : "Unfinished",
      t.discarded_at ? `Discarded: ${stamp(t.discarded_at)}` : "",
    ].filter(Boolean);
    const earlier = data.versions
      .filter((v) => v.thought_id === t.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((v) => `### ${stamp(v.created_at)}\n\n${v.body}\n`);
    const text = meta.join("  \n") + "\n\n---\n\n" + t.body + "\n" + (earlier.length ? `\n---\n\n## Earlier versions\n\n${earlier.join("\n")}` : "");
    files[names.get(t.id)!] = strToU8(text);
  }
  for (const th of data.threads) {
    const items = sorted.filter((t) => t.thread_id === th.id);
    const lines = items.map((t) => `- ${stamp(t.created_at)}: [${t.body.split("\n")[0].slice(0, 80)}](../${names.get(t.id)})`);
    files[`threads/${slug(th.title, 60)}.md`] = strToU8(`# ${th.title}\n\nStarted ${stamp(th.created_at)}\n\n${lines.join("\n")}\n`);
  }
  files["README.txt"] = strToU8(
    `Your Strata export, made ${stamp(data.exported_at)}.\n\n` +
      `thoughts/   one file per thought, oldest first, with earlier versions at the bottom\n` +
      `threads/    one file per thread, listing its thoughts in order\n` +
      `discarded/  thoughts you had discarded but not yet deleted\n` +
      `strata-data.json   everything again in one technical file, for moving to another app\n\n` +
      `The .md files are plain text. Any notes app or text editor can open them.\n`
  );
  files["strata-data.json"] = strToU8(JSON.stringify(data, null, 2));
  return zipSync(files, { level: 6 });
}
