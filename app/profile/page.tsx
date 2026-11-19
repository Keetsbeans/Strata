"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../providers";
import { useData } from "@/lib/useData";
import { day } from "@/lib/dates";
import { getName, setName } from "@/lib/profile";
import { markIntro } from "@/lib/intro";
import { plainTextZip } from "@/lib/exportText";
import Icon from "@/components/Icon";
import Avatar from "@/components/Avatar";
import Dialog from "@/components/Dialog";
import Mascot from "@/components/Mascot";

function Go({ href, title, sub, icon }: { href: string; title: string; sub?: string; icon: string }) {
  return (
    <Link href={href} className="setting go" style={{ textDecoration: "none" }}>
      <Icon name={icon} size={20} />
      <span className="grow stack" style={{ gap: 2 }}>
        <strong style={{ fontWeight: 600, fontSize: 15 }}>{title}</strong>
        {sub && <span className="small muted">{sub}</span>}
      </span>
      <Icon name="chevron" size={18} />
    </Link>
  );
}

/** Profile: who you are in Strata, your numbers, settings, your data and your account. */
export default function Profile() {
  const { store, mode, email, signOut, deleteAccount } = useApp();
  const router = useRouter();
  const [name, setNameText] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => setNameText(getName()), []);

  const { data } = useData(async () => {
    const [thoughts, interests, collections] = await Promise.all([store.thoughts(), store.interests(), store.collections()]);
    const done = thoughts.filter((t) => t.finished);
    const first = [...thoughts.map((t) => t.created_at), ...interests.map((i) => i.created_at)].sort()[0];
    const days = new Set(done.map((t) => new Date(t.created_at).toDateString())).size;
    return { thoughts: done.length, interests: interests.length, collections: collections.length, days, first };
  }, [store]);

  const exportAll = async () => {
    const all = await store.exportAll();
    const zip = plainTextZip(all as Parameters<typeof plainTextZip>[0]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
    a.download = `strata-export-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const cloud = mode === "cloud";
  const WORD = "DELETE";

  return (
    <main className="screen no-nav" style={{ gap: 18 }}>
      <header className="between">
        <button className="icon-btn round" aria-label="Back" onClick={() => router.back()}>
          <Icon name="back" />
        </button>
        <h1 className="h-mid">Profile</h1>
        <span style={{ width: 48 }} />
      </header>

      <section className="card stack has-mascot" style={{ alignItems: "center", textAlign: "center", gap: 8, padding: "20px 16px", boxShadow: "4px 4px 0 var(--lilac)" }}>
        <Mascot size={62} className="card-mascot" arms="wave" eyes="happy" />
        <Avatar size={76} />
        {editing ? (
          <form
            className="row"
            style={{ width: "100%" }}
            onSubmit={(e) => (e.preventDefault(), setName(draft), setNameText(draft.trim()), setEditing(false))}
          >
            <input className="input" style={{ minHeight: 44 }} autoFocus aria-label="Your name" placeholder="Your name" value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 40))} />
            <button className="btn sm ink">Save</button>
          </form>
        ) : (
          <>
            <strong style={{ fontSize: 22, fontWeight: 600 }}>{name || "Add your name"}</strong>
            <button className="link small" style={{ minHeight: 32, fontWeight: 500 }} onClick={() => (setDraft(name), setEditing(true))}>
              {name ? "Change name" : "Add a name"}
            </button>
          </>
        )}
        <span className="small muted">{cloud ? `Signed in as ${email ?? "you"}` : "Trying it out. Everything stays on this phone."}</span>
      </section>

      <section className="profile-stats" aria-label="Your numbers">
        <div><b>{data?.thoughts ?? "–"}</b><span>thoughts</span></div>
        <div><b>{data?.interests ?? "–"}</b><span>interests</span></div>
        <div><b>{data?.collections ?? "–"}</b><span>collections</span></div>
        <div><b>{data?.days ?? "–"}</b><span>days written</span></div>
      </section>
      {data?.first && <p className="small muted" style={{ margin: "-8px 0 0", textAlign: "center" }}>Keeping your line since {day(data.first)}</p>}

      <section className="stack" style={{ gap: 10 }}>
        <h2 style={{ fontSize: 15 }}>App</h2>
        <Go href="/settings/" icon="settings" title="Settings" sub="Colour theme, app lock, voice typing, writing" />
        <Go href="/calendar/" icon="calendar" title="Calendar" sub="Your thoughts and interests, month by month" />
        <button className="setting go" onClick={() => (markIntro(false), router.push("/"))} style={{ font: "inherit", color: "inherit", textAlign: "left", width: "100%" }}>
          <Icon name="restore" size={20} />
          <span className="grow stack" style={{ gap: 2 }}>
            <strong style={{ fontWeight: 600, fontSize: 15 }}>Watch the intro again</strong>
            <span className="small muted">The three opening screens</span>
          </span>
        </button>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <h2 style={{ fontSize: 15 }}>Your data</h2>
        <button className="setting go" onClick={exportAll} style={{ font: "inherit", color: "inherit", textAlign: "left", width: "100%" }}>
          <Icon name="download" size={20} />
          <span className="grow stack" style={{ gap: 2 }}>
            <strong style={{ fontWeight: 600, fontSize: 15 }}>Export everything</strong>
            <span className="small muted">Plain text files anyone can open</span>
          </span>
        </button>
        <Go href="/discarded/" icon="trash" title="Discarded thoughts" sub="Bring back something you threw away" />
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <h2 style={{ fontSize: 15 }}>Account</h2>
        {!cloud && <p className="small muted" style={{ margin: 0 }}>Accounts are coming soon. They will keep your notes safe if you lose your phone, and let you use Strata on more than one device.</p>}
        <button className="btn block" onClick={() => setLeaving(true)}>{cloud ? "Sign out" : "Start over"}</button>
        <button className="btn block danger" onClick={() => (setConfirm(""), setErr(""), setDeleting(true))}>
          {cloud ? "Delete my account" : "Delete everything on this phone"}
        </button>
      </section>

      <p className="small muted" style={{ textAlign: "center", margin: 0 }}>
        Strata · no ads, no AI reading your words.
      </p>

      {leaving && (
        <Dialog
          title={cloud ? "Sign out?" : "Start over?"}
          body={cloud ? "Your thoughts stay safe in your account. The app lock on this phone is switched off." : "Your try-out thoughts on this phone will be erased."}
          face="asking"
          onClose={() => setLeaving(false)}
          actions={
            <>
              <button className="btn ink block" onClick={signOut}>{cloud ? "Sign out" : "Erase and start over"}</button>
              <button className="btn block" onClick={() => setLeaving(false)}>Stay</button>
            </>
          }
        />
      )}
      {deleting && (
        <Dialog
          title={cloud ? "Delete your account?" : "Delete everything?"}
          body={
            cloud
              ? "Every thought, thread, interest and collection is deleted for good, along with your account. This cannot be undone. Export first if you want a copy."
              : "Every thought, interest and collection on this phone is deleted for good. This cannot be undone. Export first if you want a copy."
          }
          face="worried"
          onClose={() => setDeleting(false)}
          actions={
            <>
              <button
                className="btn block danger-fill"
                disabled={confirm.trim().toUpperCase() !== WORD}
                onClick={() => deleteAccount().catch((e) => setErr(e instanceof Error ? e.message : "Something went wrong."))}
              >
                Delete for good
              </button>
              <button className="btn block" onClick={() => setDeleting(false)}>Keep everything</button>
            </>
          }
        >
          <label className="stack" style={{ gap: 6 }}>
            <span className="small">Type {WORD} to confirm</span>
            <input className="input" style={{ minHeight: 44 }} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="characters" />
          </label>
          {err && <p className="error small">{err}</p>}
        </Dialog>
      )}
    </main>
  );
}
