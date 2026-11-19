import { strFromU8, unzipSync } from "fflate";
import type { ShelfImport } from "@/lib/store/types";
import { interestKey } from "./match";

/** Reads Letterboxd and Goodreads export files on the phone. Nothing is uploaded anywhere. */

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!head) return [];
  const keys = head.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

/** "2023-11-08" → an ISO time at midday, so it lands on the right day in any time zone */
function dateIso(d?: string) {
  if (!d) return undefined;
  const m = d.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).toISOString();
}
const num = (s?: string) => {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};
/** Letterboxd rates out of 5 in halves; Strata uses whole dots */
const dots = (r: number | null) => (r ? Math.min(5, Math.max(1, Math.round(r))) : null);

export type ImportSummary = { data: ShelfImport; done: number; want: number; reviews: number; file: string };

export function readLetterboxd(files: Record<string, string>, file: string): ImportSummary {
  const get = (name: string) => {
    const key = Object.keys(files).find((k) => k.split("/").pop()?.toLowerCase() === name);
    return key ? parseCsv(files[key]) : [];
  };
  const items = new Map<string, ShelfImport["items"][number]>();
  const add = (r: Record<string, string>, status: "want" | "done") => {
    const title = r["Name"];
    if (!title) return null;
    const year = num(r["Year"]);
    const key = interestKey({ kind: "film", title, year });
    const prev = items.get(key);
    if (prev) {
      if (status === "done" && prev.status !== "done") Object.assign(prev, { status, done_at: dateIso(r["Watched Date"] || r["Date"]) });
      return key;
    }
    items.set(key, {
      key,
      kind: "film",
      title,
      year,
      source: "letterboxd",
      source_id: r["Letterboxd URI"] || null,
      status,
      done_at: status === "done" ? dateIso(r["Watched Date"] || r["Date"]) ?? null : null,
      added_at: dateIso(r["Date"]),
      links: r["Letterboxd URI"] ? [{ url: r["Letterboxd URI"], title: `${title} on Letterboxd`, added_at: new Date().toISOString() }] : [],
    });
    return key;
  };
  const watchedRows = get("watched.csv");
  const diary = get("diary.csv");
  const ratings = get("ratings.csv");
  const reviewRows = get("reviews.csv");
  const watchlist = get("watchlist.csv");
  for (const r of [...watchedRows, ...diary, ...ratings, ...reviewRows]) add(r, "done");
  for (const r of ratings) {
    const it = items.get(interestKey({ kind: "film", title: r["Name"], year: num(r["Year"]) }));
    if (it) it.rating = dots(num(r["Rating"]));
  }
  for (const r of watchlist) add(r, "want");
  const reviews = reviewRows
    .filter((r) => r["Review"])
    .map((r) => ({ key: interestKey({ kind: "film", title: r["Name"], year: num(r["Year"]) }), body: r["Review"], written_at: dateIso(r["Date"] || r["Watched Date"]) ?? new Date().toISOString() }));
  const list = [...items.values()];
  return { data: { source: "letterboxd", items: list, reviews }, done: list.filter((x) => x.status === "done").length, want: list.filter((x) => x.status === "want").length, reviews: reviews.length, file };
}

const cleanReview = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

export function readGoodreads(csv: string, file: string): ImportSummary {
  const items: ShelfImport["items"] = [];
  const reviews: ShelfImport["reviews"] = [];
  const seen = new Set<string>();
  for (const r of parseCsv(csv)) {
    const title = r["Title"];
    if (!title) continue;
    const shelf = r["Exclusive Shelf"] || "read";
    const status = shelf === "read" ? "done" : "want";
    const year = num(r["Original Publication Year"]) ?? num(r["Year Published"]);
    const key = interestKey({ kind: "book", title, year });
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      key,
      kind: "book",
      title,
      creator: r["Author"] || "",
      year,
      source: "goodreads",
      source_id: r["Book Id"] || null,
      status,
      rating: dots(num(r["My Rating"])),
      done_at: status === "done" ? dateIso(r["Date Read"]) ?? null : null,
      added_at: dateIso(r["Date Added"]),
      links: r["Book Id"] ? [{ url: `https://www.goodreads.com/book/show/${r["Book Id"]}`, title: `${title} on Goodreads`, added_at: new Date().toISOString() }] : [],
    });
    const body = cleanReview(r["My Review"] || "");
    if (body) reviews.push({ key, body, written_at: dateIso(r["Date Read"] || r["Date Added"]) ?? new Date().toISOString() });
  }
  return { data: { source: "goodreads", items, reviews }, done: items.filter((x) => x.status === "done").length, want: items.filter((x) => x.status === "want").length, reviews: reviews.length, file };
}

/** a .zip from Letterboxd, or a .csv from either */
export async function readShelfFile(f: File, from: "letterboxd" | "goodreads"): Promise<ImportSummary> {
  const buf = new Uint8Array(await f.arrayBuffer());
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  if (isZip) {
    const all = unzipSync(buf, { filter: (e) => e.name.toLowerCase().endsWith(".csv") && !e.name.includes("/deleted/") && !e.name.includes("/orphaned/") });
    const files = Object.fromEntries(Object.entries(all).map(([k, v]) => [k, strFromU8(v)]));
    if (from === "goodreads") {
      const csv = Object.values(files).find((t) => t.includes("Exclusive Shelf"));
      if (!csv) throw new Error("This doesn't look like a Goodreads export.");
      return readGoodreads(csv, f.name);
    }
    const s = readLetterboxd(files, f.name);
    if (!s.data.items.length) throw new Error("No films found. Pick the .zip file Letterboxd sent you.");
    return s;
  }
  const text = strFromU8(buf);
  if (text.includes("Exclusive Shelf")) return readGoodreads(text, f.name);
  if (/(^|\n)﻿?Date,Name,Year/.test(text) || text.includes("Letterboxd URI")) {
    const name = f.name.toLowerCase().includes("watchlist") ? "watchlist.csv" : f.name.toLowerCase().includes("review") ? "reviews.csv" : f.name.toLowerCase().includes("rating") ? "ratings.csv" : "watched.csv";
    return readLetterboxd({ [name]: text }, f.name);
  }
  throw new Error(from === "goodreads" ? "This doesn't look like a Goodreads export. Pick the .csv file Goodreads made." : "This doesn't look like a Letterboxd export. Pick the .zip file Letterboxd sent you.");
}
