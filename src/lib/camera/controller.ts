import type { CameraPreset, CameraProfile } from "@/lib/pose/types";

type CameraFrame = {
  video: HTMLVideoElement;
  timestampMs: number;
  frameIndex: number;
  fps: number;
  width: number;
  height: number;
};

type CameraControllerOptions = {
  video: HTMLVideoElement;
  preset?: CameraPreset;
  onFrame: (frame: CameraFrame) => void | Promise<void>;
  onDisconnect?: () => void;
  onReset?: () => void;
};

const CAMERA_PROFILES: Record<CameraPreset, CameraProfile> = {
  desktop_hq: {
    preset: "desktop_hq",
    label: "Desktop HQ",
    width: 1280,
    height: 720,
    frameRate: 30,
    mirroredPreview: true,
    facingMode: "user",
  },
  desktop_balanced: {
    preset: "desktop_balanced",
    label: "Desktop Balanced",
    width: 960,
    height: 540,
    frameRate: 24,
    mirroredPreview: true,
    facingMode: "user",
  },
  desktop_low: {
    preset: "desktop_low",
    label: "Desktop Low",
    width: 640,
    height: 360,
    frameRate: 20,
    mirroredPreview: true,
    facingMode: "user",
  },
};

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export function getCameraProfile(preset: CameraPreset) {
  return CAMERA_PROFILES[preset];
}

export function createCameraController(options: CameraControllerOptions) {
  const video = options.video as VideoWithFrameCallback;
  let stream: MediaStream | null = null;
  let running = false;
  let frameHandle: number | null = null;
  let animationHandle: number | null = null;
  let frameIndex = 0;
  let epoch = 0;
  let slowFrames = 0;
  let facingMode: "user" | "environment" = "user";
  let lastTimestampMs = 0;
  let lastMediaTime = -1;
  let framePending = false;
  let previewVisible = true;
  let stallReported = false;
  let profile = CAMERA_PROFILES[options.preset ?? "desktop_hq"];

  const emitFrame = async (timestampMs: number) => {
    if (framePending) return;
    framePending = true;
    try {
      lastMediaTime = video.currentTime;
      stallReported = false;
      const delta = lastTimestampMs > 0 ? Math.max(timestampMs - lastTimestampMs, 1) : 1000 / profile.frameRate;
      lastTimestampMs = timestampMs;
      frameIndex += 1;
      await options.onFrame({
        video,
        timestampMs,
        frameIndex,
        fps: Math.round(1000 / delta),
        width: video.videoWidth || profile.width,
        height: video.videoHeight || profile.height,
      });
    } finally {
      framePending = false;
    }
  };

  const scheduleFrame = () => {
    if (!running || document.hidden) return;

    if (previewVisible && typeof video.requestVideoFrameCallback === "function") {
      const scheduledEpoch = epoch;
      frameHandle = video.requestVideoFrameCallback(async () => {
        if (!running || scheduledEpoch !== epoch) return;
        await emitFrame(performance.now());
        if (scheduledEpoch === epoch) scheduleFrame();
      });
      return;
    }

    const scheduledEpoch = epoch;
    animationHandle = window.requestAnimationFrame(async now => {
      if (!running || scheduledEpoch !== epoch) return;
      if (video.currentTime !== lastMediaTime && (!lastTimestampMs || now - lastTimestampMs >= 1000 / profile.frameRate)) {
        await emitFrame(now);
      } else if (lastTimestampMs && now - lastTimestampMs > 1000 && !stallReported) {
        stallReported = true;
        lastTimestampMs = 0;
        options.onReset?.();
      }
      if (scheduledEpoch === epoch) scheduleFrame();
    });
  };

  const stopScheduling = () => {
    if (frameHandle !== null && typeof video.cancelVideoFrameCallback === "function") {
      video.cancelVideoFrameCallback(frameHandle);
      frameHandle = null;
    }
    if (animationHandle !== null) {
      window.cancelAnimationFrame(animationHandle);
      animationHandle = null;
    }
  };

  const stopTracks = () => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
  };

  const buildConstraints = () => ({
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: profile.width },
      height: { ideal: profile.height },
      frameRate: { ideal: profile.frameRate, max: profile.frameRate },
    },
  });

  const normalizeCameraError = (error: unknown) => {
    const err = error as { name?: string; message?: string };
    switch (err?.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return new Error("Camera permission was blocked. Allow camera access in your browser and system settings, then try again.");
      case "NotFoundError":
      case "DevicesNotFoundError":
        return new Error("No camera was found on this device.");
      case "NotReadableError":
      case "TrackStartError":
        return new Error("Your camera is busy in another app. Close Zoom, Meet, Photo Booth, or other camera apps and try again.");
      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return new Error("This camera does not support the requested quality settings.");
      case "SecurityError":
        return new Error("Camera access is blocked by browser security settings. Open the app over HTTPS or localhost and allow camera permissions.");
      default:
        return new Error(err?.message || "Failed to access camera.");
    }
  };

  const handleVisibility = () => {
    epoch++; stopScheduling(); lastTimestampMs = 0; options.onReset?.();
    if (!document.hidden) scheduleFrame();
  };
  const handleOrientation = () => { lastTimestampMs = 0; options.onReset?.(); };
  return {
    async start(nextPreset?: CameraPreset) {
      if (nextPreset) {
        profile = CAMERA_PROFILES[nextPreset];
      }

      const startEpoch = ++epoch;
      running = false;
      stopScheduling();
      stopTracks();
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not support camera access. Use Chrome or Edge over HTTPS or localhost.");
      }

      const presetsToTry: CameraPreset[] = nextPreset
        ? [nextPreset, "desktop_balanced", "desktop_low"]
        : [profile.preset, "desktop_balanced", "desktop_low"];

      let lastError: unknown = null;
      let acquired: MediaStream | null = null;
      for (const presetName of Array.from(new Set(presetsToTry))) {
        profile = CAMERA_PROFILES[presetName];
        try {
          acquired = await navigator.mediaDevices.getUserMedia(buildConstraints());
          break;
        } catch (error) {
          lastError = error;
          if (startEpoch !== epoch) throw new Error("Camera start cancelled");
        }
      }

      if (!acquired) {
        try {
          acquired = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });
        } catch (error) {
          lastError = error;
        }
      }

      if (startEpoch !== epoch) {
        acquired?.getTracks().forEach(track => track.stop());
        throw new Error("Camera start cancelled");
      }
      if (!acquired) throw normalizeCameraError(lastError);
      stream = acquired;

      const track = stream.getVideoTracks()[0];
      track?.addEventListener("ended", () => {
        running = false;
        stopScheduling();
        options.onDisconnect?.();
      });

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      try { await video.play(); } catch (error) {
        acquired.getTracks().forEach(track => track.stop());
        if (startEpoch === epoch) stopTracks();
        throw normalizeCameraError(error);
      }
      if (startEpoch !== epoch) {
        acquired.getTracks().forEach(track => track.stop());
        throw new Error("Camera start cancelled");
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("orientationchange", handleOrientation);
      document.addEventListener("visibilitychange", handleVisibility);
      window.addEventListener("orientationchange", handleOrientation);

      running = true;
      frameIndex = 0;
      lastTimestampMs = 0;
      lastMediaTime = -1;
      stallReported = false;
      scheduleFrame();

      return {
        profile,
        settings: track?.getSettings?.() ?? {},
      };
    },
    setPreviewVisible(visible: boolean) {
      if (previewVisible === visible) return;
      previewVisible = visible;
      epoch++;
      stopScheduling();
      lastTimestampMs = 0;
      lastMediaTime = video.currentTime;
      scheduleFrame();
    },
    async setFacingMode(next: "user" | "environment") {
      facingMode = next; options.onReset?.();
      return this.start(profile.preset);
    },
    async adaptLatency(latencyMs: number) {
      slowFrames = latencyMs > 65 ? slowFrames + 1 : 0;
      if (slowFrames < 30 || profile.preset === "desktop_low") return;
      slowFrames = 0;
      profile = CAMERA_PROFILES[profile.preset === "desktop_hq" ? "desktop_balanced" : "desktop_low"];
      try { await stream?.getVideoTracks()[0]?.applyConstraints({ width: { ideal: profile.width }, height: { ideal: profile.height }, frameRate: { ideal: profile.frameRate, max: profile.frameRate } }); } catch { /* Keep the usable camera stream; worker also downgrades its model. */ }
    },
    async setPreset(nextPreset: CameraPreset) {
      if (profile.preset === nextPreset && running) {
        return profile;
      }
      profile = CAMERA_PROFILES[nextPreset];
      if (running) {
        await this.start(nextPreset);
      }
      return profile;
    },
    stop() {
      epoch++;
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("orientationchange", handleOrientation);
      running = false;
      stopScheduling();
      stopTracks();
    },
    isRunning() {
      return running;
    },
    getProfile() {
      return profile;
    },
  };
}
