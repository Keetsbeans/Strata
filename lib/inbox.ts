import type { Interest, Thought } from "./types";

const NUDGE_AFTER = 30 * 86400000;

/**
 * What comes back today. Rule-based only, never AI:
 *  - thoughts written on this day in an earlier year
 *  - things you wanted to watch, read or hear, saved over a month ago (and not nudged in the last month)
 */
export function comingBack(thoughts: Thought[], interests: Interest[], now = new Date()) {
  const yearAgo = thoughts.filter((t) => {
    const d = new Date(t.created_at);
    return t.finished && d.getFullYear() < now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  });
  const waiting = interests
    .filter((i) => i.status === "want" && i.kind !== "article" && now.getTime() - new Date(i.created_at).getTime() > NUDGE_AFTER && (!i.nudged_at || now.getTime() - new Date(i.nudged_at).getTime() > NUDGE_AFTER))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, 3);
  return { yearAgo, waiting };
}

