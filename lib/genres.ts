import type { InterestKind } from "./types";

/** Starting suggestions. Anyone can type their own, and those show up as suggestions next time. */
export const GENRES: Record<InterestKind, string[]> = {
  film: ["Drama", "Comedy", "Romance", "Thriller", "Horror", "Sci-fi", "Fantasy", "Animation", "Documentary", "Crime", "Mystery", "Action", "Musical", "War", "Western", "Family"],
  book: ["Fiction", "Non-fiction", "Literary", "Mystery", "Fantasy", "Sci-fi", "Romance", "History", "Biography", "Memoir", "Essays", "Poetry", "Philosophy", "Self-help", "Classics"],
  music: ["Pop", "Rock", "Jazz", "Classical", "Electronic", "Hip-hop", "R&B", "Folk", "Ambient", "Soul", "Indie", "Metal", "Country", "Soundtrack", "World"],
  article: ["Essay", "News", "Science", "Culture", "Design", "Technology", "Politics", "Food", "Travel", "Interview"],
};

/** your own genres first, then the suggestions, without repeats */
export function genreChoices(kind: InterestKind, used: string[]) {
  const seen = new Set<string>();
  return [...used, ...GENRES[kind]].filter((g) => {
    const k = g.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
