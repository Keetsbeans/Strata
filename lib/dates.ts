const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function time(d: Date) {
  let h = d.getHours();
  const m = d.getMinutes();
  const pm = h >= 12;
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${pm ? "pm" : "am"}`;
}

/** "Fri 13 Nov". The year is only added outside the current year. */
export function day(iso: string | Date, opts: { weekday?: boolean } = {}) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const now = new Date();
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? " " + d.getFullYear() : ""}`;
  return opts.weekday === false ? base : `${DAYS[d.getDay()]} ${base}`;
}

/** "Today, 6:12 pm", "Yesterday, 8:05 am" or "Fri 13 Nov, 11:42 pm" */
export function stamp(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return `Today, ${time(d)}`;
  if (sameDay(d, y)) return `Yesterday, ${time(d)}`;
  return `${day(d)}, ${time(d)}`;
}

export function daysLeft(discardedAt: string, keepDays: number) {
  const ms = new Date(discardedAt).getTime() + keepDays * 86400000 - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

export function discardedLabel(iso: string) {
  const d = new Date(iso);
  return sameDay(d, new Date()) ? "Discarded today" : `Discarded ${day(d)}`;
}

export { sameDay, DAYS, MONTHS };

/** "today", "yesterday" or "Fri 13 Nov" */
export function relDay(iso: string) {
  const s = stamp(iso);
  if (s.startsWith("Today")) return "today";
  if (s.startsWith("Yesterday")) return "yesterday";
  return day(iso);
}
