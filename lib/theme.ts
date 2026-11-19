/** Colour themes. The choice is kept on this phone and applied before the page draws. */
export const THEMES = [
  { id: "lilac", name: "Lilac and butter", colours: ["#C3A6F5", "#E6DB86", "#DCE4F2"], paper: "#EFEDE8" },
  { id: "navy", name: "Navy and mustard", colours: ["#17223B", "#E9B949", "#BCCBE0"], paper: "#EEECE6" },
  { id: "terracotta", name: "Terracotta and olive", colours: ["#D9805A", "#B5B98C", "#E6C7B4"], paper: "#F0EBE4" },
  { id: "sage", name: "Sage and rose", colours: ["#9DB89A", "#E8B4B0", "#E3E8DA"], paper: "#EDEEE8" },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];
const KEY = "strata:theme";

export function getTheme(): ThemeId {
  try {
    const t = localStorage.getItem(KEY);
    if (THEMES.some((x) => x.id === t)) return t as ThemeId;
  } catch {}
  return "lilac";
}

export function setTheme(id: ThemeId) {
  try {
    localStorage.setItem(KEY, id);
  } catch {}
  document.documentElement.dataset.theme = id;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", THEMES.find((x) => x.id === id)!.paper);
}

/** runs in <head> so the right colours show from the first frame */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t)document.documentElement.dataset.theme=t}catch(e){}`;
