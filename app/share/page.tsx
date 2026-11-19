"use client";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../providers";
import { KIND_LABEL } from "@/lib/types";
import { day, time } from "@/lib/dates";
import { firstUrl, linkPicture, recognise } from "@/lib/catalog/links";
import { Choice } from "@/components/Dialog";
import Poster from "@/components/Poster";

/**
 * "Share to Strata": Android sends links here from any app's share menu
 * (set up in manifest.webmanifest as a share target). Nothing leaves the phone
 * except the title, later, to find a poster.
 */
function Share() {
  const { store } = useApp();
  const router = useRouter();
  const q = useSearchParams();
  const sharedTitle = q.get("title") ?? "";
  const sharedText = q.get("text") ?? "";
  const url = q.get("url") || firstUrl(sharedText) || firstUrl(sharedTitle);
  const r = useMemo(() => (url ? recognise(url, sharedTitle || sharedText.replace(url, "").trim()) : null), [url, sharedTitle, sharedText]);
  const [title, setTitle] = useState(r?.title ?? "");
  const [to, setTo] = useState<"interests" | "inbox">(r && r.kind !== "article" ? "interests" : "inbox");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => new Date());

  if (!url) {
    const words = [sharedTitle, sharedText].filter(Boolean).join("\n\n").trim();
    return (
      <main className="screen no-nav">
        <h1 className="h-mid">Save to Strata</h1>
        {words ? (
          <>
            <div className="card"><p className="serif" style={{ margin: 0, fontSize: 18, lineHeight: 1.35, whiteSpace: "pre-wrap" }}>{words}</p></div>
            <button
              className="btn ink block"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const t = await store.addThought({ body: words.slice(0, 100000), kind: words.length > 320 ? "page" : "card", finished: false });
                router.replace(`/write/?id=${t.id}`);
              }}
            >
              Start a thought with it
            </button>
          </>
        ) : (
          <p className="muted">Nothing came through. Try sharing again.</p>
        )}
        <button className="btn block" onClick={() => router.replace("/")}>Cancel</button>
      </main>
    );
  }

  const r2 = r!;
  const L = KIND_LABEL[r2.kind];
  const save = async () => {
    setBusy(true);
    if (to === "inbox") {
      await store.addLink({ url, title: title.trim() || r2.title, note: note.trim() });
      router.replace("/inbox/?tab=sort");
      return;
    }
    const pic = linkPicture(url);
    const it = await store.addInterest({
      kind: r2.kind,
      title: title.trim().slice(0, 500) || r2.host,
      year: r2.year,
      image_url: pic,
      image_checked: r2.kind === "article" || !!pic,
      source: "link",
      links: [{ url, title: sharedTitle || r2.host, added_at: new Date().toISOString() }],
    });
    if (note.trim()) await store.addThought({ body: note.trim(), kind: "card", finished: true, interest_id: it.id });
    router.replace(`/interest/?id=${it.id}`);
  };

  return (
    <main className="screen no-nav" style={{ gap: 16 }}>
      <div className="between">
        <h1 className="h-mid">Save to Strata</h1>
        <span className="small muted">{day(now)} · {time(now)}</span>
      </div>
      <div className="item-row">
        <Poster src={linkPicture(url)} title={title || r2.host} kind={r2.kind} className="thumb" />
        <span className="grow">
          <strong>{title || r2.host}{r2.year ? ` (${r2.year})` : ""}</strong>
          <span className="sub">{r2.host}{r2.kind !== "article" ? ` · recognised as ${r2.label === "series" ? "a series" : r2.label === "album" ? "an album" : "a " + r2.label}` : ""}</span>
        </span>
      </div>
      <label className="stack" style={{ gap: 6 }}>
        <span className="small" style={{ fontWeight: 600 }}>Title</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="stack" role="radiogroup" aria-label="Where should it go?" style={{ gap: 8 }}>
        <strong style={{ fontSize: 15, fontWeight: 600 }}>Where should it go?</strong>
        <Choice on={to === "interests"} title={`Saved, ${L.want.toLowerCase()}`} sub={`Adds it to your ${L.many.toLowerCase()}, with its ${r2.kind === "film" ? "poster" : r2.kind === "article" ? "link" : "cover"}.`} onClick={() => setTo("interests")} />
        <Choice on={to === "inbox"} title="Inbox, sort later" sub="Waits under To sort until you file it." onClick={() => setTo("inbox")} />
      </div>
      <label className="stack" style={{ gap: 6 }}>
        <span className="small" style={{ fontWeight: 600 }}>A thought to go with it (optional)</span>
        <textarea className="input serif" rows={3} style={{ padding: "12px 16px", fontSize: 17, minHeight: 90 }} placeholder="Why did you save it?" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="row" style={{ marginTop: 4 }}>
        <button className="btn grow" onClick={() => router.replace("/")}>Cancel</button>
        <button className="btn ink grow shadow" disabled={busy} onClick={save}>Save</button>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Share />
    </Suspense>
  );
}
