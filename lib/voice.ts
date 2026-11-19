"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Voice typing has two modes:
 *  - "private" (default): a small Whisper speech model runs on the phone itself. Audio never leaves the device.
 *  - "live": the phone's own speech service (Google on Android, Apple on iPhone). Words appear while you speak,
 *    but that service hears the audio. Only used if the person turns it on in Settings.
 */
export type VoiceMode = "private" | "live";
const KEY = "strata:voice";
export const MODEL_SIZE = "about 90 MB";

export function liveSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}
export function privateSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(typeof navigator.mediaDevices?.getUserMedia === "function" && (window as any).MediaRecorder && typeof WebAssembly === "object" && typeof Worker !== "undefined");
}
export function getVoiceMode(): VoiceMode {
  try {
    return localStorage.getItem(KEY) === "live" && liveSupported() ? "live" : "private";
  } catch {
    return "private";
  }
}
/** Has the person seen the first-time pop-up and picked a way (or set it in Settings)? */
export function voiceChosen(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return true;
  }
}
export function setVoiceMode(m: VoiceMode) {
  try {
    localStorage.setItem(KEY, m);
  } catch {}
}

/* ---------- private mode: one shared worker that holds the model ---------- */
type Listener = (m: any) => void;
let worker: Worker | null = null;
const listeners = new Set<Listener>();
let nextId = 1;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e) => listeners.forEach((l) => l(e.data));
  }
  return worker;
}
const base = () => process.env.NEXT_PUBLIC_BASE_PATH || "";

export function onModel(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
/** Start getting the model ready (downloads once, then the browser keeps it). */
export function warmUp() {
  getWorker().postMessage({ type: "load", base: base() });
}
/** Turn 16 kHz mono audio into text, on this device. */
export function transcribe(audio: Float32Array): Promise<string> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const off = onModel((m) => {
      if (m.id !== id) return;
      if (m.type === "text") {
        off();
        resolve(m.text);
      } else if (m.type === "error") {
        off();
        reject(new Error(m.message));
      }
    });
    getWorker().postMessage({ type: "run", id, base: base(), audio }, [audio.buffer]);
  });
}

/** Decode a recording (webm/mp4) to 16 kHz mono, the format Whisper expects. */
export async function toMono16k(blob: Blob): Promise<Float32Array> {
  const buf = await blob.arrayBuffer();
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx = new Ctx({ sampleRate: 16000 });
  try {
    const audio: AudioBuffer = await ctx.decodeAudioData(buf);
    if (audio.sampleRate === 16000 && audio.numberOfChannels === 1) return audio.getChannelData(0).slice();
    const off = new OfflineAudioContext(1, Math.ceil(audio.duration * 16000), 16000);
    const src = off.createBufferSource();
    src.buffer = audio;
    src.connect(off.destination);
    src.start();
    return (await off.startRendering()).getChannelData(0).slice();
  } finally {
    ctx.close?.();
  }
}
