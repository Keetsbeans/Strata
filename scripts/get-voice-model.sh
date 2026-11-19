#!/usr/bin/env bash
# Downloads the private speech model (Whisper base, quantized) into a folder the app serves itself.
# Usage: scripts/get-voice-model.sh <target folder>   e.g. out/models   or   public/models
set -euo pipefail
DEST="${1:-public/models}/whisper-base"
SRC="https://huggingface.co/onnx-community/whisper-base/resolve/main"
mkdir -p "$DEST/onnx"
for f in config.json generation_config.json preprocessor_config.json tokenizer.json tokenizer_config.json \
         onnx/encoder_model_quantized.onnx onnx/decoder_model_merged_quantized.onnx; do
  curl -fsSL --retry 4 -o "$DEST/$f" "$SRC/$f"
done
du -sh "$DEST"
