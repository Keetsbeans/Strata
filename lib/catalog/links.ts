import type { InterestKind } from "@/lib/types";

/** What a link looks like it points to. Worked out on the phone from the address alone: nothing is fetched. */
export type Recognised = { url: string; host: string; kind: InterestKind; title: string; year: number | null; label: string };

export function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[).,!?]+$/, "") : null;
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\.|^m\./, "");
  } catch {
    return url;
  }
}

const words = (slug: string) =>
  decodeURIComponent(slug)
    .replace(/^\d+[-.]?/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** "Paterson (2016)", "Paterson (2016) - IMDb", "Paterson (2016) • Letterboxd" → title and year */
function splitTitle(t: string) {
  const clean = t
    .replace(/\s*[-–—|•·]\s*(IMDb|Letterboxd|Goodreads|YouTube|Spotify|Apple Music|Wikipedia).*$/i, "")
    .replace(/\s+on (Letterboxd|Spotify|Apple Music|Goodreads)$/i, "")
    .replace(/^(Watch|Listen to)\s+/i, "")
    .trim();
  const m = clean.match(/^(.*?)\s*\((\d{4})\)\s*$/);
  return m ? { title: m[1].trim(), year: Number(m[2]) } : { title: clean, year: null };
}

export function recognise(url: string, sharedTitle = ""): Recognised {
  const host = hostOf(url);
  let path = "";
  try {
    path = new URL(url).pathname;
  } catch {}
  const fromTitle = splitTitle(sharedTitle);
  const pick = (kind: InterestKind, label: string, slugTitle = "", year: number | null = null): Recognised => ({
    url,
    host,
    kind,
    label,
    title: fromTitle.title || slugTitle || host,
    year: fromTitle.year ?? year,
  });

  let m: RegExpMatchArray | null;
  if (/letterboxd\.com$/.test(host) && (m = path.match(/\/film\/([^/]+)/))) {
    const y = m[1].match(/-(\d{4})$/);
    return pick("film", "film", words(m[1].replace(/-\d{4}$/, "")), y ? Number(y[1]) : null);
  }
  if (/imdb\.com$/.test(host) && /\/title\/tt\d+/.test(path)) return pick("film", "film");
  if (/themoviedb\.org$/.test(host) && (m = path.match(/\/(movie|tv)\/\d+-?([^/]*)/))) return pick("film", m[1] === "tv" ? "series" : "film", words(m[2] || ""));
  if (/goodreads\.com$/.test(host) && (m = path.match(/\/book\/show\/\d+[-.]?([^/?]*)/))) return pick("book", "book", words(m[1]));
  if (/openlibrary\.org$/.test(host) && /\/(works|books)\//.test(path)) return pick("book", "book", words(path.split("/").pop() || ""));
  if (/(open\.spotify\.com|music\.apple\.com|bandcamp\.com|music\.youtube\.com|tidal\.com|deezer\.com)$/.test(host)) {
    const label = /\/(track|song)\b|[?&]i=/.test(url) ? "song" : /\/album\b/.test(path) ? "album" : "music";
    return pick("music", label, /music\.apple\.com/.test(host) ? words(path.split("/").filter(Boolean).slice(-2, -1)[0] || "") : "");
  }
  const last = path.split("/").filter(Boolean).pop() || "";
  const slug = /[a-z]-[a-z]/i.test(last) ? words(last.replace(/\.(html?|php)$/, "")) : "";
  return pick("article", /youtube\.com|youtu\.be|vimeo\.com/.test(host) ? "video" : "article", slug);
}

/** a picture we can show for a link without fetching the page: YouTube thumbnails only */
export function linkPicture(url: string): string | null {
  try {
    const u = new URL(url);
    const id = /youtu\.be$/.test(u.hostname) ? u.pathname.slice(1) : /youtube\.com$/.test(u.hostname.replace(/^(www|m)\./, "")) ? u.searchParams.get("v") : null;
    return id && /^[\w-]{6,20}$/.test(id) ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}
