/** The name shown on the Profile page and Home. Kept on this phone only; never sent anywhere. */
const KEY = "strata:name";

export function getName() {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setName(name: string) {
  try {
    if (name.trim()) localStorage.setItem(KEY, name.trim().slice(0, 40));
    else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event("strata:name"));
}
