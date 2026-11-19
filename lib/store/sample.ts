import type { Collection, CollectionItem, Interest, SavedLink, Thought, Thread } from "@/lib/types";

/** A few example thoughts so the try-out mode doesn't open empty. */
export function sampleData() {
  const ago = (days: number, h: number, m: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(h, m, 0, 0);
    // never in the future, even early in the morning
    const latest = Date.now() - (days + 1) * 3600000;
    return new Date(Math.min(d.getTime(), latest)).toISOString();
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
    t("s1", "Almost nothing happens in Perfect Days and I couldn't look away.", ["Cinema"], ago(9, 22, 30), { thread_id: thread.id, interest_id: "i1" }),
    t("s2", "My best mornings are the ones I don't have to decide anything.", ["Personal"], ago(5, 7, 40), { thread_id: thread.id }),
    t("s3", "Maybe routine isn't the opposite of freedom. He seems freer than anyone I know.", ["Cinema"], ago(0, 9, 12), { thread_id: thread.id, interest_id: "i1" }),
    t("s4", "Why do people perform busyness for each other? Is it status, or fear of being seen as unnecessary? I notice I do it most with people I want to impress.", ["Sociology", "Personal"], ago(4, 23, 42)),
    t("s5", "A website is closer to a room than a poster.", ["Creativity"], ago(6, 8, 5)),
    t("s6", "I remember songs by where I was standing.", [], ago(15, 19, 18)),
    t("s7", "The train window is the only screen I never get tired of. Every time I", [], ago(1, 21, 4), { finished: false }),
  ];
  const item = (id: string, kind: Interest["kind"], title: string, creator: string, year: number, when: string, extra: Partial<Interest> = {}): Interest => ({
    id, kind, title, creator, year, image_url: null, image_checked: false, source: "manual", source_id: null, status: "done", rating: null,
    moods: [], genres: [], favourite: false, links: [], created_at: when, updated_at: when, done_at: when, nudged_at: null, ...extra,
  });
  const interests: Interest[] = [
    item("i1", "film", "Perfect Days", "Wim Wenders", 2023, ago(9, 22, 0), { rating: 4, moods: ["Quiet"], genres: ["Drama"], favourite: true }),
    item("i2", "film", "Paterson", "Jim Jarmusch", 2016, ago(42, 20, 0), { status: "want", done_at: null, moods: ["Quiet"] }),
    item("i3", "film", "Columbus", "Kogonada", 2017, ago(30, 21, 0), { moods: ["Quiet"] }),
    item("i4", "book", "The Remains of the Day", "Kazuo Ishiguro", 1989, ago(8, 10, 0), { status: "want", done_at: null }),
  ];
  const collections: Collection[] = [
    { id: "c1", title: "Films that stayed with me", note: "The ones I still think about weeks later.", created_at: ago(8, 21, 0), updated_at: ago(1, 21, 0) },
  ];
  const collectionItems: CollectionItem[] = [
    { id: "ci1", collection_id: "c1", interest_id: "i1", thought_id: null, added_at: ago(8, 21, 0) },
    { id: "ci2", collection_id: "c1", interest_id: null, thought_id: "s3", added_at: ago(0, 9, 20) },
    { id: "ci3", collection_id: "c1", interest_id: "i3", thought_id: null, added_at: ago(1, 21, 0) },
  ];
  const links: SavedLink[] = [
    { id: "l1", url: "https://en.wikipedia.org/wiki/Slow_living", title: "Slow living - Wikipedia", note: "", created_at: ago(1, 18, 0) },
  ];
  return { thoughts, threads: [thread], versions: [], interests, collections, collectionItems, links };
}
