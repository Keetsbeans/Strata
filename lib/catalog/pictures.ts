"use client";
import { useEffect, useRef } from "react";
import type { Store } from "@/lib/store/types";
import type { Interest } from "@/lib/types";
import { bestMatch } from "./search";

/**
 * Items brought in by an import, a shared link or typed by hand have no picture yet.
 * This looks one up for each, one at a time, sending only the title (and year).
 * Each item is only ever looked up once.
 */
const busy = new Set<string>();

export function usePictureFill(store: Store, items: Interest[] | null | undefined, onFound: (it: Interest) => void) {
  const found = useRef(onFound);
  found.current = onFound;
  useEffect(() => {
    if (!items) return;
    let stop = false;
    const todo = items.filter((i) => !i.image_checked && !i.image_url && i.kind !== "article" && !busy.has(i.id)).slice(0, 60);
    (async () => {
      for (const it of todo) {
        if (stop) return;
        if (typeof navigator !== "undefined" && !navigator.onLine) return;
        busy.add(it.id);
        try {
          const hit = await bestMatch(it);
          if (stop) return;
          const patch: Partial<Interest> = { image_checked: true };
          if (hit) {
            patch.image_url = hit.image_url;
            if (!it.creator && hit.creator) patch.creator = hit.creator;
            if (!it.year && hit.year) patch.year = hit.year;
          }
          found.current(await store.updateInterest(it.id, patch));
        } catch {
          // offline or the catalogue is busy: try again another time
          return;
        } finally {
          busy.delete(it.id);
        }
      }
    })();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, items?.map((i) => i.id + (i.image_checked ? 1 : 0)).join()]);
}
