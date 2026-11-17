import type { Thought, Thread } from "@/lib/types";

/** A few example thoughts so the try-out mode doesn't open empty. */
export function sampleData() {
  const ago = (days: number, h: number, m: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const thread: Thread = { id: "sample-thread", title: "On routine and freedom", state: "ongoing", created_at: ago(9, 22, 30), discarded_at: null, released_ids: [] };
  const t = (id: string, body: string, topics: string[], when: string, extra: Partial<Thought> = {}): Thought => ({
    id,
    body,
    kind: "card",
    topics,
    finished: true,
    kept: false,
    thread_id: null,
    created_at: when,
    updated_at: when,
    discarded_at: null,
    version_count: 0,
    ...extra,
  });
  const thoughts: Thought[] = [
    t("s1", "Almost nothing happens in Perfect Days and I couldn't look away.", ["Cinema"], ago(9, 22, 30), { thread_id: thread.id }),
    t("s2", "My best mornings are the ones I don't have to decide anything.", ["Personal"], ago(5, 7, 40), { thread_id: thread.id }),
    t("s3", "Maybe routine isn't the opposite of freedom. He seems freer than anyone I know.", ["Cinema"], ago(0, 9, 12), { thread_id: thread.id }),
    t("s4", "Why do people perform busyness for each other? Is it status, or fear of being seen as unnecessary? I notice I do it most with people I want to impress.", ["Sociology", "Personal"], ago(4, 23, 42)),
    t("s5", "A website is closer to a room than a poster.", ["Creativity"], ago(6, 8, 5)),
    t("s6", "I remember songs by where I was standing.", [], ago(15, 19, 18)),
    t("s7", "The train window is the only screen I never get tired of. Every time I", [], ago(1, 21, 4), { finished: false }),
  ];
  return { thoughts, threads: [thread], versions: [] };
}
