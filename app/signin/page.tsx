"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { homeUrl, supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";

function SignInForm() {
  const isNew = useSearchParams().get("new") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  const sb = supabase();
  if (!sb) return <p className="error">Accounts aren&apos;t switched on yet. Go back and try Strata on this phone.</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = isNew
      ? await sb.auth.signUp({ email, password, options: { emailRedirectTo: homeUrl() } })
      : await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (res.error) return setError(res.error.message);
    if (isNew && !res.data.session) setSent("Check your email and tap the link to finish creating your account.");
  };
  const link = async () => {
    if (!email) return setError("Type your email first.");
    setBusy(true);
    setError("");
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: homeUrl(), shouldCreateUser: isNew } });
    setBusy(false);
    if (error) return setError(error.message);
    setSent("We sent a sign-in link to " + email + ". Open it on this phone.");
  };

  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
      <label className="stack" style={{ gap: 6, fontWeight: 600, fontSize: 13 }}>
        Email
        <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="stack" style={{ gap: 6, fontWeight: 600, fontSize: 13 }}>
        Password
        <input
          className="input"
          type="password"
          autoComplete={isNew ? "new-password" : "current-password"}
          minLength={isNew ? 8 : undefined}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {isNew && <span className="small muted" style={{ fontWeight: 400 }}>At least 8 characters.</span>}
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      {sent && <p className="card" role="status" style={{ margin: 0 }}>{sent}</p>}
      <button className="btn ink block shadow" disabled={busy}>
        {isNew ? "Create account" : "Sign in"}
      </button>
      <button type="button" className="link" style={{ fontWeight: 500 }} onClick={link} disabled={busy}>
        Email me a sign-in link instead
      </button>
    </form>
  );
}

function SignInPage() {
  const isNew = useSearchParams().get("new") === "1";
  return (
    <main className="screen no-nav">
      <header className="between">
        <Link href="/welcome/" className="icon-btn round" aria-label="Back">
          <Icon name="back" />
        </Link>
        <span className="h-mid" style={{ fontWeight: 600 }}>{isNew ? "Create account" : "Sign in"}</span>
        <span style={{ width: 48 }} />
      </header>
      <h1 className="h-title" style={{ marginTop: 12 }}>
        {isNew ? "Start your line" : "Welcome back"}
      </h1>
      <SignInForm />
      <p className="small muted" style={{ textAlign: "center", margin: 0 }}>
        Your archive stays private to this account.
      </p>
    </main>
  );
}

export default function SignIn() {
  return (
    <Suspense>
      <SignInPage />
    </Suspense>
  );
}
