"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { leaveUndo, useData } from "@/lib/useData";
import { day, stamp, time } from "@/lib/dates";
import Icon from "@/components/Icon";
import Dialog from "@/components/Dialog";
import ThreadPicker from "@/components/ThreadPicker";
import Poster from "@/components/Poster";
import { CollectionPicker, InterestPicker } from "@/components/Pickers";
import { details } from "@/lib/interests";
import { preview, topicColour } from "@/components/ThoughtCard";

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

function ThoughtView() {
  const { store } = useApp();
  const router = useRouter();
  const id = useSearchParams().get("id") || "";
  const { data, error, reload } = useData(async () => {
    const t = await store.thought(id);
    const thread = t?.thread_id ? await store.thread(t.thread_id) : null;
    const inThread = thread ? (await store.thoughts()).filter((x) => x.thread_id === thread.id).length : 0;
    const about = t?.interest_id ? await store.interest(t.interest_id) : null;
    return { t, thread, inThread, about };
  }, [store, id]);
  const [versions, setVersions] = useState<{ id: string; body: string; created_at: string }[] | null>(null);
  const [asking, setAsking] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pinning, setPinning] = useState<null | "interest" | "collection">(null);
  const [saved, setSaved] = useState("");

  if (error) return <main className="screen no-nav"><p className="error">{error}</p></main>;
  if (!data) return <main className="screen no-nav" />;
  const { t, thread, inThread, about } = data;
  if (!t || t.discarded_at)
    return (
      <main className="screen no-nav">
        <p className="error">This thought isn&apos;t here any more. It may be in Discarded.</p>
        <Link className="btn" href="/thoughts/">Back to thoughts</Link>
      </main>
    );
  const d = new Date(t.created_at);

  const discard = async () => {
    await store.discardThoughts([t.id]);
    leaveUndo({ ids: [t.id], title: "Moved to Discarded", line: `“${preview(t.body, 40)}”` });
    router.replace("/thoughts/");
  };

  return (
    <main className="screen no-nav">
      <header className="between">
        <button className="icon-btn round" aria-label="Back" onClick={() => router.back()}>
          <Icon name="back" />
        </button>
        <span className="h-mid" style={{ fontWeight: 600 }}>Thought</span>
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn sm" href={`/write/?id=${t.id}`}>
            Edit
          </Link>
          <button className="icon-btn" aria-label="Delete this thought" onClick={() => setAsking(true)}>
            <Icon name="trash" size={18} width={2} />
          </button>
        </div>
      </header>
      <div className="small muted">
        <strong style={{ color: "var(--ink)" }}>{day(d)}</strong> · {time(d)}
      </div>
      <div className="card" style={{ padding: "16px 18px 18px" }}>
        <div className="ruled-text">{t.body}</div>
      </div>
      {t.topics.length > 0 && (
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {t.topics.map((x) => (
            <span key={x} className={"tag " + topicColour(x)}>{x}</span>
          ))}
        </div>
      )}
      {t.version_count > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="small muted">
            Edited {times(t.version_count)}.{" "}
            {!versions && (
              <button className="link" style={{ minHeight: 0, fontSize: 12 }} onClick={() => store.versions(t.id).then(setVersions)}>
                See earlier versions
              </button>
            )}
          </span>
          {versions?.map((v) => (
            <div key={v.id} className="card dashed stack" style={{ gap: 4 }}>
              <span className="small muted">Before {stamp(v.created_at)}</span>
              <p className="serif" style={{ margin: 0, fontSize: 16, lineHeight: 1.35 }}>{v.body}</p>
            </div>
          ))}
        </div>
      )}
      <section className="stack" style={{ gap: 8 }}>
        <h2 style={{ fontSize: 15 }}>Connected to</h2>
        {about && (
          <div className="item-row" style={{ paddingRight: 6 }}>
            <Poster src={about.image_url} title={about.title} kind={about.kind} className="thumb" />
            <Link className="grow" href={`/interest/?id=${about.id}`} style={{ textDecoration: "none" }}>
              <strong>{about.title}</strong>
              <span className="sub">{details(about)}</span>
            </Link>
            <button className="icon-btn" style={{ border: 0, background: "transparent" }} aria-label={`Unpin from ${about.title}`} onClick={async () => (await store.updateThought(t.id, { interest_id: null }), reload())}>
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        {thread ? (
          <Link href={`/thread/?id=${thread.id}`} className="card between" style={{ textDecoration: "none" }}>
            <strong style={{ fontWeight: 600 }}>{thread.title}</strong>
            <span className="small muted">Thread · {inThread} {inThread === 1 ? "thought" : "thoughts"}</span>
          </Link>
        ) : (
          !about && <span className="small muted">Not part of a thread yet.</span>
        )}
      </section>
      <div className="stack" style={{ gap: 10 }}>
        {!about && (
          <button className="btn block" onClick={() => setPinning("interest")}>
            Pin to a film, book or song
          </button>
        )}
        <button className="btn block" onClick={() => setPinning("collection")}>
          Add to a collection
        </button>
        {saved && <span className="small muted" role="status" style={{ textAlign: "center" }}>{saved}</span>}
        <button className="btn block" onClick={() => setPicking(true)}>
          {thread ? "Move to another thread" : "Add to a thread"}
        </button>
        {thread && (
          <button className="link" style={{ fontWeight: 500 }} onClick={async () => (await store.updateThought(t.id, { thread_id: null }), reload())}>
            Take it out of this thread
          </button>
        )}
      </div>
      {asking && (
        <Dialog
          title="Move this thought to Discarded?"
          body={`It stays in Discarded for 30 days. You can restore it any time before then.${thread ? ` It will also leave its thread, “${thread.title}”.` : ""}`}
          face="worried"
          onClose={() => setAsking(false)}
          actions={
            <>
              <button className="btn ink block" onClick={discard}>
                Move to Discarded
              </button>
              <button className="btn block" onClick={() => setAsking(false)}>
                Keep it
              </button>
            </>
          }
        />
      )}
      {pinning === "interest" && (
        <InterestPicker
          store={store}
          onClose={() => setPinning(null)}
          onPick={async (iid) => {
            await store.updateThought(t.id, { interest_id: iid });
            setPinning(null);
            reload();
          }}
        />
      )}
      {pinning === "collection" && (
        <CollectionPicker
          store={store}
          onClose={() => setPinning(null)}
          onPick={async (cid) => {
            await store.addToCollection(cid, { thought_id: t.id });
            const c = await store.collection(cid);
            setPinning(null);
            setSaved(`Added to ${c?.title ?? "the collection"}.`);
          }}
        />
      )}
      {picking && (
        <ThreadPicker
          store={store}
          onClose={() => setPicking(false)}
          onPick={async (tid) => {
            await store.updateThought(t.id, { thread_id: tid });
            setPicking(false);
            reload();
          }}
        />
      )}
    </main>
  );
}

export default function ThoughtPage() {
  return (
    <Suspense>
      <ThoughtView />
    </Suspense>
  );
}
