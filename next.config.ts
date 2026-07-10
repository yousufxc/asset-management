import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/worker packages must be loaded from node_modules at runtime, not
  // bundled by webpack. `canvas` is a native .node addon; tesseract.js (WASM +
  // workers) and pdfjs-dist (dynamic requires) also break when bundled — this
  // is the cause of the MODULE_NOT_FOUND / "Cannot read properties of undefined"
  // 500s the OCR fallback hit.
  serverExternalPackages: ["node:sqlite", "canvas", "tesseract.js", "pdfjs-dist"],
};

export default nextConfig;
