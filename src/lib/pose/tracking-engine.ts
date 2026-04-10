import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { buildTrackingFrame, estimateMotion } from "@/lib/pose/confidence";
import type { ExerciseId, Landmark, SessionTelemetryEvent, TrackingFrame } from "@/lib/pose/types";

type CameraFrame = {
  video: HTMLVideoElement;
  timestampMs: number;
  frameIndex: number;
  fps: number;
};

type PoseModelQuality = "full" | "lite";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";
const MODEL_ASSETS: Record<PoseModelQuality, string> = {
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};

function mapLandmarks(landmarks: Array<{ x: number; y: number; z?: number; visibility?: number }> | undefined) {
  return (landmarks ?? []).map((item) => ({
    x: item.x,
    y: item.y,
    z: item.z,
    visibility: item.visibility ?? 1,
  })) as Landmark[];
}

function createBrightnessSampler() {
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const ctx = canvas?.getContext("2d", { willReadFrequently: true }) ?? null;
  let lastBrightness = 80;

  return {
    sample(video: HTMLVideoElement, frameIndex: number) {
      if (!canvas || !ctx || frameIndex % 12 !== 0) {
        return lastBrightness;
      }

      canvas.width = 32;
      canvas.height = 18;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let total = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        total += (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
      }
      lastBrightness = Math.round(total / Math.max(pixels.length / 4, 1));
      return lastBrightness;
    },
  };
}

export function createPoseTrackingEngine(options: {
  onTelemetry?: (event: SessionTelemetryEvent) => void;
}) {
  let landmarker: PoseLandmarker | null = null;
  let previousSmoothed: Landmark[] | null = null;
  let previousRaw: Landmark[] | null = null;
  let modelQuality: PoseModelQuality = "full";
  let reloading = false;
  let lowFpsFrames = 0;
  const brightnessSampler = createBrightnessSampler();

  const emitTelemetry = (event: SessionTelemetryEvent) => {
    options.onTelemetry?.(event);
  };

  const load = async (quality: PoseModelQuality) => {
    const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
    const next = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_ASSETS[quality],
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.55,
      minPosePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
      outputSegmentationMasks: false,
    });

    landmarker?.close();
    landmarker = next;
    modelQuality = quality;
  };

  return {
    async init() {
      if (!landmarker) {
        await load(modelQuality);
      }
    },
    async processFrame(cameraFrame: CameraFrame, exerciseId: ExerciseId): Promise<TrackingFrame | null> {
      if (!landmarker) {
        await load(modelQuality);
      }

      if (!landmarker) return null;

      const result = landmarker.detectForVideo(cameraFrame.video, cameraFrame.timestampMs);
      const rawLandmarks = mapLandmarks(result.landmarks?.[0]);
      const worldLandmarks = mapLandmarks(result.worldLandmarks?.[0]);

      if (!rawLandmarks.length) {
        return null;
      }

      const brightness = brightnessSampler.sample(cameraFrame.video, cameraFrame.frameIndex);
      const motion = estimateMotion(previousRaw, rawLandmarks);
      const trackingFrame = buildTrackingFrame({
        exerciseId,
        rawLandmarks,
        worldLandmarks,
        previousSmoothed,
        timestampMs: cameraFrame.timestampMs,
        frameIndex: cameraFrame.frameIndex,
        fps: cameraFrame.fps,
        brightness,
        motion,
      });

      previousRaw = rawLandmarks;
      previousSmoothed = trackingFrame.smoothedLandmarks;

      if (cameraFrame.fps < 15) {
        lowFpsFrames += 1;
      } else {
        lowFpsFrames = 0;
      }

      if (lowFpsFrames >= 45 && modelQuality === "full" && !reloading) {
        reloading = true;
        emitTelemetry({
          timestampMs: cameraFrame.timestampMs,
          type: "model_quality_downgrade",
          message: "Pose model downgraded to lite after sustained low FPS.",
          meta: {
            fps: cameraFrame.fps,
            from: "full",
            to: "lite",
          },
        });
        try {
          await load("lite");
        } finally {
          lowFpsFrames = 0;
          reloading = false;
        }
      }

      return trackingFrame;
    },
    reset() {
      previousSmoothed = null;
      previousRaw = null;
      lowFpsFrames = 0;
    },
    async stop() {
      previousSmoothed = null;
      previousRaw = null;
      lowFpsFrames = 0;
      landmarker?.close();
      landmarker = null;
      modelQuality = "full";
    },
    getModelQuality() {
      return modelQuality;
    },
  };
}
