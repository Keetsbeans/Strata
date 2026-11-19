import type { Collection, CollectionItem, Interest } from "@/lib/types";
import Poster from "./Poster";

/** the chosen cover, or a collage of the first few pictures */
export default function BoardCover({ c, interests }: { c: Collection & { items: CollectionItem[] }; interests: Map<string, Interest> }) {
  const chosen = c.cover_id ? interests.get(c.cover_id) : null;
  const pics = chosen ? [chosen] : (c.items.map((x) => (x.interest_id ? interests.get(x.interest_id) : null)).filter(Boolean) as Interest[]).slice(0, 4);
  if (!pics.length) return <span className="board-cover n1" aria-hidden="true" style={{ background: "var(--blue)" }} />;
  return (
    <span className={`board-cover n${pics.length}`} aria-hidden="true">
      {pics.map((i) => (
        <Poster key={i.id} src={i.image_url} title={i.title} kind={i.kind} />
      ))}
    </span>
  );
}
