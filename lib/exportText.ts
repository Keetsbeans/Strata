import { zipSync, strToU8 } from "fflate";
import type { Collection, CollectionItem, Interest, SavedLink, Thought, Thread, ThoughtVersion } from "./types";
import { KIND_LABEL } from "./types";

type Data = {
  exported_at: string;
  thoughts: Thought[];
  threads: Thread[];
  versions: ThoughtVersion[];
  interests?: Interest[];
  collections?: Collection[];
  collectionItems?: CollectionItem[];
  links?: SavedLink[];
};

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
  const interests = data.interests ?? [];
  const itemTitle = new Map(interests.map((i) => [i.id, `${i.title}${i.year ? ` (${i.year})` : ""}`]));
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
      t.interest_id && itemTitle.get(t.interest_id) ? `About: ${itemTitle.get(t.interest_id)}` : "",
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
  for (const kind of ["film", "book", "music", "article"] as const) {
    const list = interests.filter((i) => i.kind === kind).sort((a, b) => a.title.localeCompare(b.title));
    if (!list.length) continue;
    const L = KIND_LABEL[kind];
    const lines = list.map((i) => {
      const bits = [i.status === "done" ? L.done : L.want, i.creator, i.rating ? `${i.rating}/5` : "", i.moods.join(", "), (i.genres ?? []).join(", "), i.favourite ? "favourite" : ""].filter(Boolean);
      const pinned = sorted.filter((t) => t.interest_id === i.id && !t.discarded_at).map((t) => `  - ${stamp(t.created_at)}: [${t.body.split("\n")[0].slice(0, 80)}](../${names.get(t.id)})`);
      const links = i.links.map((l) => `  - ${l.title || l.url}: ${l.url}`);
      return [`- **${itemTitle.get(i.id)}** · ${bits.join(" · ")}`, ...pinned, ...links].join("\n");
    });
    files[`interests/${L.many.toLowerCase()}.md`] = strToU8(`# ${L.many}\n\n${lines.join("\n")}\n`);
  }
  for (const c of data.collections ?? []) {
    const lines = (data.collectionItems ?? [])
      .filter((x) => x.collection_id === c.id)
      .map((x) => (x.interest_id ? `- ${itemTitle.get(x.interest_id) ?? "(removed)"}` : x.thought_id && names.get(x.thought_id) ? `- Thought: [${data.thoughts.find((t) => t.id === x.thought_id)?.body.split("\n")[0].slice(0, 80)}](../${names.get(x.thought_id)})` : ""))
      .filter(Boolean);
    files[`collections/${slug(c.title, 60)}.md`] = strToU8(`# ${c.title}\n\n${c.note ? c.note + "\n\n" : ""}${lines.join("\n")}\n`);
  }
  if (data.links?.length) files["inbox-links.md"] = strToU8(`# Links saved to sort\n\n${data.links.map((l) => `- ${l.title || l.url}: ${l.url}${l.note ? ` (${l.note})` : ""}`).join("\n")}\n`);
  files["README.txt"] = strToU8(
    `Your Strata export, made ${stamp(data.exported_at)}.\n\n` +
      `thoughts/   one file per thought, oldest first, with earlier versions at the bottom\n` +
      `threads/    one file per thread, listing its thoughts in order\n` +
      `discarded/  thoughts you had discarded but not yet deleted\n` +
      `interests/  your films, books, music and articles, with the thoughts pinned to each\n` +
      `collections/  one file per collection\n` +
      `strata-data.json   everything again in one technical file, for moving to another app\n\n` +
      `The .md files are plain text. Any notes app or text editor can open them.\n`
  );
  files["strata-data.json"] = strToU8(JSON.stringify(data, null, 2));
  return zipSync(files, { level: 6 });
}
