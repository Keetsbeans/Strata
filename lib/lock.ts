/**
 * App lock: a PIN (and optionally the phone's fingerprint or face unlock) asked for when Strata opens.
 * The PIN is never stored, only a slow salted hash of it, on this device.
 */
type LockData = { salt: string; hash: string; cred?: string };
const KEY = "strata:lock";
const OPEN = "strata:unlocked";
export const RELOCK_AFTER_MS = 60_000;

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function read(): LockData | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}
function write(d: LockData | null) {
  try {
    if (d) localStorage.setItem(KEY, JSON.stringify(d));
    else localStorage.removeItem(KEY);
  } catch {}
}

async function hashPin(pin: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: 200_000 }, base, 256);
  return b64(bits);
}

export const lockEnabled = () => read() !== null;
export const fingerprintEnabled = () => Boolean(read()?.cred);

export async function setPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  write({ salt: b64(salt), hash: await hashPin(pin, salt), cred: read()?.cred });
  markUnlocked();
}

export async function checkPin(pin: string) {
  const d = read();
  if (!d) return true;
  return (await hashPin(pin, unb64(d.salt))) === d.hash;
}

export function turnOffLock() {
  write(null);
}

export function fingerprintSupported() {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && Boolean(navigator.credentials);
}

export async function addFingerprint() {
  const d = read();
  if (!d) throw new Error("Set a PIN first.");
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Strata" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "Strata", displayName: "Strata" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Fingerprint was not set up.");
  write({ ...d, cred: b64(cred.rawId) });
}

export function removeFingerprint() {
  const d = read();
  if (d) write({ salt: d.salt, hash: d.hash });
}

export async function unlockWithFingerprint() {
  const d = read();
  if (!d?.cred) return false;
  try {
    const ok = await navigator.credentials.get({
      publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: "public-key", id: unb64(d.cred) }], userVerification: "required", timeout: 60_000 },
    });
    return Boolean(ok);
  } catch {
    return false;
  }
}

export function markUnlocked() {
  try {
    sessionStorage.setItem(OPEN, String(Date.now()));
  } catch {}
}
export function markLocked() {
  try {
    sessionStorage.removeItem(OPEN);
  } catch {}
}
export function isUnlocked() {
  try {
    return sessionStorage.getItem(OPEN) !== null;
  } catch {
    return false;
  }
}
