import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
await mkdir("public/mediapipe", { recursive: true });
await build({
  entryPoints: ["src/lib/pose/tracking.worker.ts"],
  outfile: "public/mediapipe/pose-worker.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: ["es2020"],
  legalComments: "eof",
  sourcemap: false,
  minify: true,
  logLevel: "warning",
});
console.log("Classic MediaPipe worker emitted");
