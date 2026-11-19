"use client";
import Link from "next/link";
import type { Thought } from "@/lib/types";
import { stamp } from "@/lib/dates";
import Icon from "./Icon";

const TAG_COLOURS = ["butter", "blue", "lilac", ""];
/** the same topic always gets the same colour */
export function topicColour(topic: string) {
  let h = 0;
  for (const c of topic.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TAG_COLOURS[h % TAG_COLOURS.length];
}

export function preview(body: string, n = 140) {
  const one = body.replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n - 1).trimEnd() + "…" : one || "Empty thought";
}

type Props = { t: Thought; selecting?: boolean; picked?: boolean; onPick?: () => void; href?: string; onPin?: () => void; threadName?: string };

export default function ThoughtCard({ t, selecting, picked, onPick, href, onPin, threadName }: Props) {
  const inner = (
    <>
      {selecting && (
        <span className={"tick" + (picked ? " on" : "")} aria-hidden="true">
          {picked && <Icon name="check" size={14} color="#FBFAF7" width={3} />}
        </span>
      )}
      <span className="between">
        <span className="small muted">{t.finished ? stamp(t.created_at) : "Unfinished · " + stamp(t.updated_at)}</span>
        {t.topics[0] && <span className={"tag " + topicColour(t.topics[0])}>{t.topics[0]}</span>}
      </span>
      <p>{preview(t.body)}</p>
      {threadName && <span className="small muted">In “{threadName}”</span>}
    </>
  );
  const cls = "card thought-card" + (selecting ? " selecting" : "") + (picked ? " picked" : "");
  if (selecting)
    return (
      <button type="button" role="checkbox" aria-checked={!!picked} className={cls} onClick={onPick}>
        {inner}
      </button>
    );
  const link = (
    <Link className={cls} href={href ?? (t.finished ? `/thought/?id=${t.id}` : `/write/?id=${t.id}`)}>
      {inner}
    </Link>
  );
  if (!onPin || !t.finished) return link;
  return (
    <div className="thought-wrap">
      {link}
      <button className={"pin-btn" + (t.thread_id ? " on" : "")} aria-label={t.thread_id ? `In ${threadName ?? "a thread"}. Put it in another thread` : "Put it in a thread"} onClick={onPin}>
        <i><Icon name="pin" size={15} width={2} /></i>
      </button>
    </div>
  );
}
