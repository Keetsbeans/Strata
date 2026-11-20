import type { Box, CapsuleInside, TimeCapsule } from "./types";

/**
 * Sealing a time capsule. Everything happens on the phone with the browser's own WebCrypto:
 *  - a fresh content key scrambles the letter and the thoughts (AES-GCM, 256 bit)
 *  - date_key is that content key, kept for the opening date
 *  - for a spare-key seal, the content key is also locked with a random spare key that is
 *    shown once and never stored, so a lost spare key cannot be reissued
 */

const DAY = 86400000;
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// no 0/O or 1/I/L, so a key copied by hand can't be misread
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function spareKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return chars.match(/.{4}/g)!.join("-"); // XXXX-XXXX-XXXX-XXXX-XXXX, about 99 bits
}
/** what someone typed, tidied: case, spaces and dashes don't matter */
const tidyKey = (k: string) => k.toUpperCase().replace(/[^A-Z0-9]/g, "");

async function aes(raw: Uint8Array) {
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function lock(raw: Uint8Array, plain: Uint8Array): Promise<Box> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aes(raw), plain as BufferSource);
  return { iv: b64(iv), data: b64(data) };
}
async function unlock(raw: Uint8Array, box: Box) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, await aes(raw), unb64(box.data)));
}
/** the spare key is long and random, so one round of SHA-256 is enough to turn it into an AES key */
async function fromSpare(key: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode("strata-capsule:" + tidyKey(key))));
}

export async function seal(inside: CapsuleInside, withKey: boolean) {
  const content = crypto.getRandomValues(new Uint8Array(32));
  const box = await lock(content, enc.encode(JSON.stringify(inside)));
  const key = withKey ? spareKey() : null;
  const key_box = key ? await lock(await fromSpare(key), content) : null;
  return { box, date_key: b64(content), key_box, key };
}

export const isReady = (c: TimeCapsule, now = Date.now()) => new Date(c.open_at).getTime() <= now;

/** opens on or after the date (or any time once it has been opened) */
export async function openOnDate(c: TimeCapsule): Promise<CapsuleInside> {
  if (!isReady(c) && !c.opened_at) throw new Error("This capsule is still sealed.");
  return JSON.parse(dec.decode(await unlock(unb64(c.date_key), c.box)));
}

/** opens early with the spare key; a wrong key throws */
export async function openWithKey(c: TimeCapsule, key: string): Promise<CapsuleInside> {
  if (!c.key_box) throw new Error("This capsule has a strict seal. It opens on its date.");
  let content: Uint8Array;
  try {
    content = await unlock(await fromSpare(key), c.key_box);
  } catch {
    throw new Error("That key doesn't fit this capsule. Check it and try again.");
  }
  return JSON.parse(dec.decode(await unlock(content, c.box)));
}

/** the spare key as a small text file to keep somewhere safe */
export function keyFile(title: string, openAt: string, key: string) {
  const when = new Date(openAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  return [
    "Strata time capsule: spare key",
    "",
    `Capsule: ${title || "Untitled"}`,
    `Opens on its own: ${when}`,
    "",
    `Spare key: ${key}`,
    "",
    "This key opens the capsule early. Strata keeps no copy and cannot make a new one.",
    "If you lose it, the capsule still opens on its date.",
    "",
  ].join("\n");
}

/** how far along the wait is, for the timeline */
export function progress(c: TimeCapsule, now = Date.now()) {
  const start = new Date(c.created_at).getTime();
  const end = new Date(c.open_at).getTime();
  const total = Math.max(end - start, DAY);
  const share = Math.min(1, Math.max(0, (now - start) / total));
  const daysLeft = Math.max(0, Math.ceil((end - now) / DAY));
  const daysIn = Math.max(0, Math.floor((now - start) / DAY));
  const half = new Date(start + total / 2);
  return { share, daysLeft, daysIn, half, passedHalf: now >= half.getTime() };
}

/** "in 3 days", "in 5 months", "in 2 years" */
export function inWords(days: number) {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 45) return `in ${days} days`;
  if (days < 548) return `in ${Math.round(days / 30.4)} months`;
  const y = Math.round(days / 365.25);
  return `in ${y} year${y === 1 ? "" : "s"}`;
}

export const whatsInside = (c: Pick<TimeCapsule, "count">) => (c.count ? `A letter and ${c.count} ${c.count === 1 ? "thought" : "thoughts"}` : "A letter");
