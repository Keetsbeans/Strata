"use client";
import { useEffect } from "react";

/** lets the phone install Strata to the home screen and open it without a connection */
export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && location.hostname !== "localhost") {
      navigator.serviceWorker.register((process.env.NEXT_PUBLIC_BASE_PATH || "") + "/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
