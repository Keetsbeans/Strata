"use client";
import { useState } from "react";
import type { Collection, CollectionItem, Interest, InterestKind, Thought } from "@/lib/types";
import Dialog from "./Dialog";

const plural: Record<InterestKind, [string, string]> = { film: ["film", "films"], book: ["book", "books"], music: ["album or song", "albums and songs"], article: ["article", "articles"] };

/** "7 films · 4 thoughts" */
export function contents(items: CollectionItem[], interests: Map<string, Interest>, thoughts: Map<string, Thought>) {
  const counts = new Map<string, number>();
  for (const x of items) {
    const k = x.interest_id ? interests.get(x.interest_id)?.kind : x.thought_id && thoughts.has(x.thought_id) ? "thought" : null;
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const parts = (["film", "book", "music", "article"] as InterestKind[]).filter((k) => counts.get(k)).map((k) => `${counts.get(k)} ${plural[k][counts.get(k) === 1 ? 0 : 1]}`);
  if (counts.get("thought")) parts.push(`${counts.get("thought")} ${counts.get("thought") === 1 ? "thought" : "thoughts"}`);
  return parts.join(" · ") || "Empty for now";
}

export function CollectionForm({ initial, onSave, onClose, onDelete }: { initial?: Collection; onSave: (title: string, note: string) => void; onClose: () => void; onDelete?: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  return (
    <Dialog
      title={initial ? "Edit collection" : "New collection"}
      onClose={onClose}
      actions={
        <>
          <button className="btn ink block" disabled={!title.trim()} onClick={() => onSave(title.trim().slice(0, 200), note.trim().slice(0, 2000))}>
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
      </div>
    </Dialog>
  );
}

