/* eslint-disable @typescript-eslint/no-explicit-any */
// Runs the Whisper speech model inside the phone's browser. Audio stays on the device:
// the model and its engine are served by Strata's own site, and remote downloads are switched off.
import { pipeline, env } from "@huggingface/transformers";

let asr: Promise<any> | null = null;

function load(base: string) {
  if (asr) return asr;
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = `${self.location.origin}${base}/models/`;
  const onnx: any = env.backends.onnx;
  onnx.wasm.wasmPaths = {
    mjs: `${self.location.origin}${base}/ort/ort-wasm-simd-threaded.mjs`,
    wasm: `${self.location.origin}${base}/ort/ort-wasm-simd-threaded.wasm`,
  };
  asr = pipeline("automatic-speech-recognition", "whisper-base", {
    device: "wasm",
    dtype: "q8",
    progress_callback: (p: any) => {
      if (p.status === "progress" && p.total) self.postMessage({ type: "progress", file: p.file, loaded: p.loaded, total: p.total });
    },
  }).then(
    (r) => {
      self.postMessage({ type: "ready" });
      return r;
    },
    (e) => {
      asr = null;
      throw e;
    }
  );
  return asr;
}

self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  try {
    if (m.type === "load") await load(m.base);
    if (m.type === "run") {
      const run = await load(m.base);
      const out = await run(m.audio, { chunk_length_s: 30, stride_length_s: 5, task: "transcribe" });
      const text = (Array.isArray(out) ? out.map((o: any) => o.text).join(" ") : out.text) || "";
      self.postMessage({ type: "text", id: m.id, text: text.trim() });
    }
  } catch (err: any) {
    self.postMessage({ type: "error", id: m.id, message: String(err?.message || err) });
  }
};
