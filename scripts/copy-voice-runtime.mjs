// Copies the speech engine (ONNX Runtime, WebAssembly) into public/ort so the app serves it itself.
// Nothing is loaded from other websites when someone uses private voice typing.
import { mkdirSync, copyFileSync } from "node:fs";
const from = "node_modules/onnxruntime-web/dist/";
mkdirSync("public/ort", { recursive: true });
for (const f of ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) copyFileSync(from + f, "public/ort/" + f);
console.log("voice runtime copied to public/ort");
