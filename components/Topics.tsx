"use client";
import { useState } from "react";
import { topicColour } from "./ThoughtCard";
import Icon from "./Icon";

/** topic chips with an "Add topic" field that suggests topics you've used before */
export default function Topics({ value, onChange, known }: { value: string[]; onChange: (t: string[]) => void; known: string[] }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const add = (t: string) => {
    const clean = t.trim().replace(/\s+/g, " ").slice(0, 40);
    if (clean && !value.some((v) => v.toLowerCase() === clean.toLowerCase())) onChange([...value, clean[0].toUpperCase() + clean.slice(1)]);
    setText("");
    setAdding(false);
  };
  const sugg = known.filter((k) => !value.includes(k) && k.toLowerCase().startsWith(text.toLowerCase())).slice(0, 5);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {value.map((t) => (
          <button key={t} type="button" className={"tag " + topicColour(t)} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => onChange(value.filter((v) => v !== t))} aria-label={`Remove topic ${t}`}>
            {t} <Icon name="close" size={12} width={2.6} />
          </button>
        ))}
        {!adding && (
          <button type="button" className="tag" style={{ minHeight: 44, borderStyle: "dashed", background: "transparent", fontWeight: 500 }} onClick={() => setAdding(true)}>
            + Add topic
          </button>
        )}
      </div>
      {adding && (
        <div className="stack" style={{ gap: 8 }}>
          <form className="row" onSubmit={(e) => (e.preventDefault(), add(text))}>
            <input className="input" autoFocus placeholder="A topic, like Cinema" value={text} onChange={(e) => setText(e.target.value)} aria-label="New topic" style={{ minHeight: 44 }} />
            <button className="btn sm ink">Add</button>
          </form>
          {sugg.length > 0 && (
            <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
              {sugg.map((s) => (
                <button key={s} type="button" className={"tag " + topicColour(s)} style={{ minHeight: 44 }} onClick={() => add(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
