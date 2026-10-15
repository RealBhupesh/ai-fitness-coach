import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { Landmark } from "@/lib/pose/types";
export type PoseWorkerRequest = { id: number; type: "init" | "frame" | "stop"; quality?: "full" | "lite"; origin?: string; bitmap?: ImageBitmap; timestampMs?: number };
export type PoseWorkerReply = { id: number; error?: string; landmarks?: Landmark[]; worldLandmarks?: Landmark[]; brightness?: number; latencyMs?: number };
let landmarker: PoseLandmarker | null = null;
let busy = false;
let brightness = 80;
let count = 0;
const scope = self as unknown as { onmessage: ((event: MessageEvent<PoseWorkerRequest>) => void) | null; postMessage: (reply: PoseWorkerReply) => void };
scope.onmessage = async ({ data }) => {
  if (busy) { data.bitmap?.close(); scope.postMessage({ id: data.id, error: "Pose worker is busy" }); return; }
  busy = true;
  try {
    if (data.type === "stop") { landmarker?.close(); landmarker = null; scope.postMessage({ id: data.id }); return; }
    if (data.type === "init") {
      const origin = data.origin!;
      const vision = await FilesetResolver.forVisionTasks(`${origin}/mediapipe/wasm`);
      let next: PoseLandmarker | null = null;
      for (const delegate of ["GPU", "CPU"] as const) {
        try {
          next = await PoseLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: `${origin}/mediapipe/models/pose_landmarker_${data.quality || "full"}.task`, delegate }, runningMode: "VIDEO", numPoses: 1, minPoseDetectionConfidence: 0.55, minPosePresenceConfidence: 0.55, minTrackingConfidence: 0.55 });
          break;
        } catch { /* Try CPU if the worker has no compatible GPU context. */ }
      }
      if (!next) throw new Error("Pose model could not initialize. Retry or use a supported browser.");
      landmarker?.close(); landmarker = next;
      scope.postMessage({ id: data.id });
      return;
    }
    if (!landmarker || !data.bitmap || data.timestampMs === undefined) throw new Error("Pose worker not initialized");
    const started = performance.now();
    if (count++ % 12 === 0 && typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(32, 18);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        context.drawImage(data.bitmap, 0, 0, 32, 18);
        const pixels = context.getImageData(0, 0, 32, 18).data;
        let total = 0;
        for (let i = 0; i < pixels.length; i += 4) total += (pixels[i] + pixels[i+1] + pixels[i+2]) / 3;
        brightness = Math.round(total / (pixels.length / 4));
      }
    }
    const result = landmarker.detectForVideo(data.bitmap, data.timestampMs);
    scope.postMessage({ id: data.id, landmarks: result.landmarks[0] ?? [], worldLandmarks: result.worldLandmarks[0] ?? [], brightness, latencyMs: performance.now() - started });
  } catch { scope.postMessage({ id: data.id, error: "Pose analysis unavailable. Restart the camera to retry." }); }
  finally { data.bitmap?.close(); busy = false; }
};
