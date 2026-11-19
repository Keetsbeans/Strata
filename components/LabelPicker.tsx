"use client";
import { useState } from "react";

/** Pick from suggestions, or type your own label. Used for moods and genres. */
export default function LabelPicker({ choices, chosen, onAdd, placeholder, dot }: { choices: string[]; chosen: string[]; onAdd: (label: string) => void; placeholder: string; dot?: (l: string) => string }) {
  const [text, setText] = useState("");
  const has = (l: string) => chosen.some((c) => c.toLowerCase() === l.toLowerCase());
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const l = text.trim().replace(/\s+/g, " ").slice(0, 24);
    if (!l || has(l)) return setText("");
    onAdd(l.charAt(0).toUpperCase() + l.slice(1));
    setText("");
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
        {choices.filter((c) => !has(c)).map((c) => (
          <button key={c} type="button" className="mood-chip" style={{ minHeight: 34 }} onClick={() => onAdd(c)}>
            {dot && <i style={{ background: dot(c) }} />}
            {c}
          </button>
        ))}
      </div>
      <form className="paste" onSubmit={add} style={{ minHeight: 44 }}>
        <input placeholder={placeholder} aria-label={placeholder} value={text} maxLength={24} onChange={(e) => setText(e.target.value)} />
        {text.trim() && <button className="btn ink">Add</button>}
      </form>
    </div>
  );
}
