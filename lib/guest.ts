/**
 * Someone who came in through the opening screens and hasn't chosen an account yet.
 * Their first save asks them to create an account, with a way to keep it on this phone instead.
 */
const GUEST = "strata:guest";
const PENDING = "strata:pending";

export type Pending = { body: string; topics: string[]; kind: "card" | "page"; finished: boolean; interest_id: string | null; thread_id: string | null };

export function isGuest() {
  try {
    return localStorage.getItem(GUEST) === "1";
  } catch {
    return false;
  }
}

export function setGuest(on: boolean) {
  try {
    if (on) localStorage.setItem(GUEST, "1");
    else localStorage.removeItem(GUEST);
  } catch {}
}

/** hold a thought while its writer goes off to make an account */
export function holdPending(p: Pending) {
  try {
    localStorage.setItem(PENDING, JSON.stringify(p));
  } catch {}
}

export function takePending(): Pending | null {
  try {
    const raw = localStorage.getItem(PENDING);
    if (!raw) return null;
    localStorage.removeItem(PENDING);
    return JSON.parse(raw) as Pending;
  } catch {
    return null;
  }
}
