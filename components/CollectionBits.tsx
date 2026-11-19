"use client";
import { useState } from "react";
import type { Collection, CollectionItem, Interest, InterestKind } from "@/lib/types";
import Dialog from "./Dialog";
import Poster from "./Poster";

const plural: Record<InterestKind, [string, string]> = { film: ["film", "films"], book: ["book", "books"], music: ["album or song", "albums and songs"], article: ["link", "links"] };

/** "7 films · 2 books" */
export function contents(items: CollectionItem[], interests: Map<string, Interest>) {
  const counts = new Map<string, number>();
  for (const x of items) {
    const k = x.interest_id ? interests.get(x.interest_id)?.kind : null;
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const parts = (["film", "book", "music", "article"] as InterestKind[]).filter((k) => counts.get(k)).map((k) => `${counts.get(k)} ${plural[k][counts.get(k) === 1 ? 0 : 1]}`);
  return parts.join(" · ") || "Empty for now";
}

export function CollectionForm({ initial, covers = [], onSave, onClose, onDelete }: { initial?: Collection; covers?: Interest[]; onSave: (title: string, note: string, cover_id: string | null) => void; onClose: () => void; onDelete?: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [cover, setCover] = useState<string | null>(initial?.cover_id ?? null);
  return (
    <Dialog
      title={initial ? "Edit collection" : "New collection"}
      onClose={onClose}
      actions={
        <>
          <button className="btn ink block" disabled={!title.trim()} onClick={() => onSave(title.trim().slice(0, 200), note.trim().slice(0, 2000), cover)}>
            {initial ? "Save" : "Make it"}
          </button>
          {onDelete && <button className="btn block" onClick={onDelete}>Delete this collection</button>}
          <button className="link" style={{ fontWeight: 500 }} onClick={onClose}>Cancel</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 8 }}>
        <input className="input" placeholder="Name, like Films that stayed with me" aria-label="Name" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <input className="input" placeholder="A line about it (optional)" aria-label="A line about it" value={note} onChange={(e) => setNote(e.target.value)} />
        {covers.length > 1 && (
          <>
            <span className="small" style={{ fontWeight: 600, marginTop: 4 }}>Cover</span>
            <div className="pills" role="radiogroup" aria-label="Cover" style={{ margin: "0 -4px", padding: "0 4px", gap: 8, alignItems: "flex-end" }}>
              <button type="button" role="radio" aria-checked={!cover} className="cover-pick" onClick={() => setCover(null)}>
                <span className="cover-collage">{covers.slice(0, 4).map((i) => <Poster key={i.id} src={i.image_url} title={i.title} kind={i.kind} />)}</span>
                <span className="small">First few</span>
              </button>
              {covers.filter((i) => i.kind !== "article").slice(0, 20).map((i) => (
                <button key={i.id} type="button" role="radio" aria-checked={cover === i.id} aria-label={`Use ${i.title} as the cover`} className="cover-pick" onClick={() => setCover(i.id)}>
                  <Poster src={i.image_url} title={i.title} kind={i.kind} />
                  <span className="small">{i.title}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
