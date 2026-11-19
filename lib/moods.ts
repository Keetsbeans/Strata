/** The "In the mood for" labels. Yours to rename; kept on this phone. */
const KEY = "strata:moods";
export const DEFAULT_MOODS = ["Quiet", "Cosy", "Heavy", "Uplifting"];
const COLOURS = ["var(--blue)", "var(--butter)", "var(--ink)", "var(--lilac)", "var(--card)"];

export function getMoods(): string[] {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) || "null");
    if (Array.isArray(m) && m.length) return m.filter((x) => typeof x === "string").slice(0, 12);
  } catch {}
  return DEFAULT_MOODS;
}

export function setMoods(m: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {}
}

/** the same mood keeps the same colour dot */
export function moodColour(mood: string) {
  const i = DEFAULT_MOODS.findIndex((x) => x.toLowerCase() === mood.toLowerCase());
  if (i >= 0) return COLOURS[i];
  let h = 0;
  for (const c of mood.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLOURS[h % COLOURS.length];
}
