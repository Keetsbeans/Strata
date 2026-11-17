"use client";
import { useCallback, useEffect, useState } from "react";

/** loads something from the store, with a reload() for after changes */
export function useData<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);
  const reload = useCallback(() => {
    run()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [run]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, reload, setData };
}

/** a one-off message carried to the next screen (used for the Undo bar) */
export type Undo = { ids: string[]; title: string; line: string };
const UNDO = "strata:undo";
export function leaveUndo(u: Undo) {
  try {
    sessionStorage.setItem(UNDO, JSON.stringify(u));
  } catch {}
}
export function takeUndo(): Undo | null {
  try {
    const u = sessionStorage.getItem(UNDO);
    sessionStorage.removeItem(UNDO);
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}
