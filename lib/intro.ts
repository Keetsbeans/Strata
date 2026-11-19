/** Whether the three opening screens have been seen on this phone. */
export const INTRO_SEEN = "strata:onboarded";

export function introSeen() {
  try {
    return localStorage.getItem(INTRO_SEEN) === "1";
  } catch {
    return true;
  }
}

export function markIntro(seen: boolean) {
  try {
    if (seen) localStorage.setItem(INTRO_SEEN, "1");
    else localStorage.removeItem(INTRO_SEEN);
  } catch {}
}
