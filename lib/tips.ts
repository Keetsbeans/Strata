/** First-visit tips: which pages' guides have been seen. Kept on this phone only. */
const KEY = "strata:tips-seen";
/** every guide in the app, plus the older one-off intros, so "Show tips again" brings them all back */
export const ALL_TIPS = ["home", "thoughts", "collections", "board", "jar", "capsules"];
const OLDER = ["strata:threads-intro", "strata:swipe-guide"];

function seen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
export const tipSeen = (id: string) => {
  try {
    return seen().includes(id) || localStorage.getItem("strata:tips-off") === "1";
  } catch {
    return true;
  }
};
export function markTip(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set([...seen(), id])]));
  } catch {}
}
/** on: any guide still to come */
export const tipsOn = () => ALL_TIPS.some((t) => !tipSeen(t));
export function setTips(on: boolean) {
  try {
    if (on) {
      localStorage.removeItem(KEY);
      localStorage.removeItem("strata:tips-off");
      OLDER.forEach((k) => localStorage.removeItem(k));
    } else {
      localStorage.setItem("strata:tips-off", "1");
      OLDER.forEach((k) => localStorage.setItem(k, "1"));
    }
  } catch {}
}
