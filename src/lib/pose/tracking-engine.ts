import { buildTrackingFrame, estimateMotion } from "@/lib/pose/confidence";
import type { ExerciseId, Landmark, SessionTelemetryEvent, TrackingFrame } from "@/lib/pose/types";
import type { PoseWorkerReply, PoseWorkerRequest } from "@/lib/pose/tracking.worker";
type CameraFrame = { video: HTMLVideoElement; timestampMs: number; frameIndex: number; fps: number; width?: number; height?: number };
export function createPoseTrackingEngine(options: { onTelemetry?: (event: SessionTelemetryEvent) => void; onPerformance?: (latencyMs: number) => void }) {
  let worker: Worker | null = null;
  let initialized: Promise<void> | null = null;
  let pending: { id: number; resolve: (reply: PoseWorkerReply) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  let id = 0;
  let generation = 0;
  let processing = false;
  let previousSmoothed: Landmark[] | null = null;
  let previousRaw: Landmark[] | null = null;
  let previousTimestamp = 0;
  let quality: "full" | "lite" = "full";
  let slowFrames = 0;
  function request(message: Omit<PoseWorkerRequest, "id">, transfer: Transferable[] = []): Promise<PoseWorkerReply> {
    if (!worker || pending) return Promise.reject(new Error("Pose worker unavailable"));
    const requestId = ++id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending = null; worker?.terminate(); worker = null; initialized = null; reject(new Error("Pose model timed out. Restart the camera to retry.")); }, message.type === "init" ? 30000 : 5000);
      pending = { id: requestId, resolve, reject, timer };
      try { worker!.postMessage({ ...message, id: requestId }, transfer); }
      catch { clearTimeout(timer); pending = null; reject(new Error("Unable to send camera frame")); }
    });
  }
  function createWorker() {
    // Classic worker lets the MediaPipe WASM loader use importScripts.
    const created = new Worker(new URL("/mediapipe/pose-worker.js", window.location.origin));
    worker = created;
    created.onmessage = ({ data }: MessageEvent<PoseWorkerReply>) => {
      if (worker !== created || !pending || pending.id !== data.id) return;
      const current = pending; pending = null; clearTimeout(current.timer);
      if (data.error) current.reject(new Error(data.error)); else current.resolve(data);
    };
    created.onerror = () => { if (worker !== created) return; if (pending) { clearTimeout(pending.timer); pending.reject(new Error("Pose worker failed. Restart the camera to retry.")); pending = null; } worker?.terminate(); worker = null; initialized = null; };
  }
  const init = () => {
    if (!initialized) {
      if (!worker) createWorker();
      const token = generation;
      initialized = request({ type: "init", quality, origin: window.location.origin }).then(() => undefined).catch(async error => {
        if (token !== generation || quality === "lite") { initialized = null; throw error; }
        quality = "lite";
        if (!worker) createWorker();
        try {
          await request({ type: "init", quality, origin: window.location.origin });
          options.onTelemetry?.({ timestampMs: 0, type: "model_quality_downgrade", message: "Using the lighter pose model after the full model could not load.", meta: { from: "full", to: "lite" } });
        } catch (fallbackError) { initialized = null; throw fallbackError; }
      });
    }
    return initialized;
  };
  const reset = () => { generation++; previousRaw = null; previousSmoothed = null; previousTimestamp = 0; slowFrames = 0; };
  return {
    init,
    async processFrame(frame: CameraFrame, exerciseId: ExerciseId): Promise<TrackingFrame | null> {
      if (processing) return null;
      processing = true;
      const token = generation;
      let bitmap: ImageBitmap | null = null;
      try {
        await init();
        if (token !== generation) return null;
        bitmap = await createImageBitmap(frame.video);
        if (token !== generation) return null;
        const imageAspectRatio = (bitmap.width || frame.video.videoWidth || frame.width || 1) / (bitmap.height || frame.video.videoHeight || frame.height || 1);
        const reply = await request({ type: "frame", bitmap, timestampMs: frame.timestampMs }, [bitmap]);
        bitmap = null;
        if (token !== generation) return null;
        options.onPerformance?.(reply.latencyMs ?? 0);
        const raw = reply.landmarks ?? [];
        if (raw.length !== 33 || raw.some(point=>!Number.isFinite(point.x)||!Number.isFinite(point.y)||(point.z!==undefined&&!Number.isFinite(point.z)))) { reset(); return null; }
        if (previousTimestamp && (frame.timestampMs <= previousTimestamp || frame.timestampMs - previousTimestamp > 1000)) { previousRaw = null; previousSmoothed = null; }
        const tracked = buildTrackingFrame({ exerciseId, rawLandmarks: raw, worldLandmarks: reply.worldLandmarks ?? [], imageAspectRatio, previousSmoothed, timestampMs: frame.timestampMs, frameIndex: frame.frameIndex, fps: frame.fps, brightness: reply.brightness ?? 80, motion: estimateMotion(previousRaw, raw) });
        previousRaw = raw; previousSmoothed = tracked.smoothedLandmarks; previousTimestamp = frame.timestampMs;
        slowFrames = (reply.latencyMs ?? 0) > 65 ? slowFrames + 1 : 0;
        if (slowFrames >= 30 && quality === "full") {
          quality = "lite"; slowFrames = 0;
          await request({ type: "init", quality, origin: window.location.origin });
          options.onTelemetry?.({ timestampMs: frame.timestampMs, type: "model_quality_downgrade", message: "Using a lighter pose model to improve responsiveness.", meta: { from: "full", to: "lite" } });
        }
        return tracked;
      } finally { bitmap?.close(); processing = false; }
    },
    reset,
    async stop() {
      reset();
      if (pending) { clearTimeout(pending.timer); pending.reject(new Error("Pose analysis stopped")); pending = null; }
      worker?.terminate(); worker = null; initialized = null; quality = "full";
    },
  };
}
