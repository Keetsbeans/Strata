"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Store } from "@/lib/store/types";
import { LocalStore, clearLocal } from "@/lib/store/local";
import { CloudStore } from "@/lib/store/cloud";
import { supabase } from "@/lib/supabase";
import { isUnlocked, lockEnabled, markLocked, RELOCK_AFTER_MS, turnOffLock } from "@/lib/lock";
import LockScreen from "@/components/LockScreen";
import { takePending } from "@/lib/guest";

type Mode = "local" | "cloud" | null;
type Ctx = {
  store: Store;
  mode: "local" | "cloud";
  email: string | null;
  startTryOut: () => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AppContext = createContext<Ctx | null>(null);
const MODE_KEY = "strata:mode";
const PUBLIC = ["/welcome/", "/signin/"];

export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error("useApp outside the app");
  return c;
}

export default function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = (usePathname() || "/").replace(/\/?$/, "/");
  const [mode, setMode] = useState<Mode | "loading">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  // work out who is here
  useEffect(() => {
    let saved: Mode = null;
    try {
      saved = localStorage.getItem(MODE_KEY) as Mode;
    } catch {}
    const sb = supabase();
    if (sb) {
      sb.auth.getSession().then(({ data }) => {
        if (data.session) {
          setEmail(data.session.user.email ?? null);
          setMode("cloud");
        } else setMode(saved === "local" ? "local" : null);
      });
      const { data } = sb.auth.onAuthStateChange((_e, session) => {
        if (session) {
          setEmail(session.user.email ?? null);
          try {
            localStorage.setItem(MODE_KEY, "cloud");
          } catch {}
          setMode("cloud");
        }
      });
      return () => data.subscription.unsubscribe();
    }
    setMode(saved === "local" ? "local" : null);
  }, []);

  // app lock: on open, and after a minute away
  useEffect(() => {
    if (lockEnabled() && !isUnlocked()) setLocked(true);
    let hiddenAt = 0;
    const vis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (lockEnabled() && hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) {
        markLocked();
        setLocked(true);
      }
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, []);

  const store = useMemo<Store | null>(() => {
    if (mode === "local") return new LocalStore();
    if (mode === "cloud") {
      const sb = supabase();
      return sb ? new CloudStore(sb) : null;
    }
    return null;
  }, [mode]);

  useEffect(() => {
    if (store) store.purge().catch(() => {});
    // a thought written before making an account lands in the new account
    if (store && mode === "cloud") {
      const p = takePending();
      if (p) store.addThought({ ...p, thread_id: null, interest_id: null }).catch(() => {});
    }
  }, [store, mode]);

  // send people without an account choice to the welcome screen
  const isPublic = PUBLIC.includes(path);
  useEffect(() => {
    if (mode === null && !isPublic) router.replace("/welcome/");
    if (mode && mode !== "loading" && isPublic) router.replace("/");
  }, [mode, isPublic, router]);

  const startTryOut = useCallback(() => {
    try {
      localStorage.setItem(MODE_KEY, "local");
    } catch {}
    setMode("local");
  }, []);

  const signOut = useCallback(async () => {
    const sb = supabase();
    if (mode === "cloud" && sb) await sb.auth.signOut();
    if (mode === "local") clearLocal();
    try {
      localStorage.removeItem(MODE_KEY);
    } catch {}
    turnOffLock();
    setEmail(null);
    setMode(null);
  }, [mode]);

  const deleteAccount = useCallback(async () => {
    const sb = supabase();
    if (mode === "cloud" && sb) {
      const { error } = await sb.rpc("delete_my_account");
      if (error) throw new Error("Your account could not be deleted. Check your connection and try again.");
    }
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith("strata:")) localStorage.removeItem(k);
    } catch {}
    await signOut();
  }, [mode, signOut]);

  if (mode === "loading") return null;
  if (locked && store)
    return (
      <LockScreen
        onUnlock={() => setLocked(false)}
        onForgot={async () => {
          await signOut();
          setLocked(false);
        }}
        tryOut={mode === "local"}
      />
    );
  if (!store) return isPublic ? <>{children}</> : null;
  if (isPublic) return null;
  return <AppContext.Provider value={{ store, mode: mode as "local" | "cloud", email, startTryOut, signOut, deleteAccount }}>{children}</AppContext.Provider>;
}

/** for the welcome screen, which sits outside the signed-in area */
export function useStartTryOut() {
  return () => {
    try {
      localStorage.setItem(MODE_KEY, "local");
    } catch {}
    window.location.replace((process.env.NEXT_PUBLIC_BASE_PATH || "") + "/");
  };
}
