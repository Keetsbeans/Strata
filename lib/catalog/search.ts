import type { Interest, InterestKind } from "@/lib/types";
import { normTitle } from "./match";

/**
 * Looks things up in public catalogues. Only the title being searched is ever sent:
 * never thoughts, notes, ratings or anything about the person.
 *  - films: TMDB when a key was added (NEXT_PUBLIC_TMDB_KEY), otherwise Wikipedia
 *  - books: Open Library
 *  - music: MusicBrainz, with covers from the Cover Art Archive
 */
export type CatalogHit = {
  kind: InterestKind;
  title: string;
  creator: string;
  year: number | null;
  image_url: string | null;
  source: string;
  source_id: string;
  /** "Film", "Series", "Album", "Song", "Book" */
  label: string;
};

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_KEY || "";
export const filmSource = TMDB_KEY ? "TMDB" : "Wikipedia";

const cache = new Map<string, Promise<CatalogHit[]>>();
function cached(key: string, run: () => Promise<CatalogHit[]>) {
  if (!cache.has(key)) cache.set(key, run().catch((e) => (cache.delete(key), Promise.reject(e))));
  return cache.get(key)!;
}

async function getJson(url: string, signal?: AbortSignal) {
  const r = await fetch(url, { signal, headers: { Accept: "application/json" }, referrerPolicy: "no-referrer", credentials: "omit" });
  if (!r.ok) throw new Error(`Search failed (${r.status})`);
  return r.json();
}

const yearOf = (s?: string | number | null) => {
  const m = String(s ?? "").match(/\d{4}/);
  return m ? Number(m[0]) : null;
};

// ---------- films ----------
async function tmdb(q: string, signal?: AbortSignal): Promise<CatalogHit[]> {
  const j = await getJson(`https://api.themoviedb.org/3/search/multi?include_adult=false&query=${encodeURIComponent(q)}&api_key=${TMDB_KEY}`, signal);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (j.results || [])
    .filter((r: any) => r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 6)
    .map((r: any) => ({
      kind: "film" as const,
      title: r.title || r.name,
      creator: "",
      year: yearOf(r.release_date || r.first_air_date),
      image_url: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : null,
      source: "tmdb",
      source_id: `${r.media_type}/${r.id}`,
      label: r.media_type === "tv" ? "Series" : "Film",
    }));
}

async function wikipediaFilms(q: string, signal?: AbortSignal): Promise<CatalogHit[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    redirects: "1",
    generator: "search",
    gsrsearch: `${q} hastemplate:"Infobox film"`,
    gsrlimit: "6",
    prop: "pageimages|description",
    piprop: "thumbnail",
    pithumbsize: "400",
    pilicense: "any",
  });
  const j = await getJson(`https://en.wikipedia.org/w/api.php?${params}`, signal);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pages: any[] = Object.values(j.query?.pages || {}).sort((a: any, b: any) => a.index - b.index);
  return pages.map((p) => {
    const desc: string = p.description || "";
    const by = desc.match(/\bby (.+)$/i);
    return {
      kind: "film" as const,
      title: String(p.title).replace(/\s*\((\d{4} )?(film|movie)\)$/i, ""),
      creator: by ? by[1].replace(/\.$/, "") : "",
      year: yearOf(desc) ?? yearOf(String(p.title).match(/\((\d{4})/)?.[1]),
      image_url: p.thumbnail?.source ?? null,
      source: "wikipedia",
      source_id: String(p.pageid),
      label: /series|television/i.test(desc) ? "Series" : "Film",
    };
  });
}

export function searchFilms(q: string, signal?: AbortSignal) {
  return cached(`film|${q.toLowerCase()}`, () => (TMDB_KEY ? tmdb(q, signal) : wikipediaFilms(q, signal)));
}

// ---------- books ----------
export function searchBooks(q: string, signal?: AbortSignal) {
  return cached(`book|${q.toLowerCase()}`, async () => {
    const j = await getJson(`https://openlibrary.org/search.json?limit=6&fields=key,title,author_name,first_publish_year,cover_i&q=${encodeURIComponent(q)}`, signal);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (j.docs || []).map((d: any) => ({
      kind: "book" as const,
      title: d.title,
      creator: (d.author_name || []).slice(0, 2).join(", "),
      year: d.first_publish_year ?? null,
      image_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
      source: "openlibrary",
      source_id: d.key,
      label: "Book",
    }));
  });
}

// ---------- music ----------
// MusicBrainz asks for no more than one request a second, so music searches wait their turn.
let lastMb = 0;
async function mb(path: string, signal?: AbortSignal) {
  const wait = lastMb + 1100 - Date.now();
  lastMb = Math.max(Date.now(), lastMb + 1100);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return getJson(`https://musicbrainz.org/ws/2/${path}`, signal);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const artists = (credit: any[] = []) => credit.map((c) => c.name + (c.joinphrase || "")).join("").trim();

export function searchMusic(q: string, signal?: AbortSignal) {
  return cached(`music|${q.toLowerCase()}`, async () => {
    const enc = encodeURIComponent(q);
    const albums = await mb(`release-group/?fmt=json&limit=4&query=${enc}`, signal);
    const songs = await mb(`recording/?fmt=json&limit=4&query=${enc}`, signal).catch(() => ({ recordings: [] }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a: CatalogHit[] = (albums["release-groups"] || []).filter((r: any) => (r.score ?? 100) >= 70).map((r: any) => ({
      kind: "music" as const,
      title: r.title,
      creator: artists(r["artist-credit"]),
      year: yearOf(r["first-release-date"]),
      image_url: `https://coverartarchive.org/release-group/${r.id}/front-250`,
      source: "musicbrainz",
      source_id: `release-group/${r.id}`,
      label: r["primary-type"] === "Single" ? "Single" : "Album",
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s: CatalogHit[] = (songs.recordings || []).filter((r: any) => (r.score ?? 100) >= 70).map((r: any) => {
      const rg = r.releases?.[0]?.["release-group"]?.id;
      return {
        kind: "music" as const,
        title: r.title,
        creator: artists(r["artist-credit"]),
        year: yearOf(r["first-release-date"]),
        image_url: rg ? `https://coverartarchive.org/release-group/${rg}/front-250` : null,
        source: "musicbrainz",
        source_id: `recording/${r.id}`,
        label: "Song",
      };
    });
    // one of each title + artist
    const seen = new Set<string>();
    return [...a, ...s].filter((h) => {
      const k = normTitle(h.title) + "|" + h.creator.toLowerCase() + "|" + h.label;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  });
}

export function searchKind(kind: InterestKind, q: string, signal?: AbortSignal): Promise<CatalogHit[]> {
  if (kind === "film") return searchFilms(q, signal);
  if (kind === "book") return searchBooks(q, signal);
  if (kind === "music") return searchMusic(q, signal);
  return Promise.resolve([]);
}

/** the best catalogue match for something already on the shelf (imports, shared links, typed by hand) */
export async function bestMatch(it: Pick<Interest, "kind" | "title" | "year" | "creator">): Promise<CatalogHit | null> {
  if (it.kind === "article") return null;
  const hits = await searchKind(it.kind, it.title + (it.kind === "film" && it.year ? ` ${it.year}` : ""));
  const want = normTitle(it.title);
  const same = hits.filter((h) => normTitle(h.title) === want);
  const pool = same.length ? same : it.kind === "film" ? [] : hits.filter((h) => normTitle(h.title).includes(want));
  const byYear = it.year ? pool.filter((h) => !h.year || Math.abs(h.year - it.year!) <= 1) : pool;
  return byYear.find((h) => h.image_url) ?? byYear[0] ?? null;
}
