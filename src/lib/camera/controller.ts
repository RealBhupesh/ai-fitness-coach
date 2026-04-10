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
  let lastTimestampMs = 0;
  let profile = CAMERA_PROFILES[options.preset ?? "desktop_hq"];

  const emitFrame = (timestampMs: number) => {
    const delta = lastTimestampMs > 0 ? Math.max(timestampMs - lastTimestampMs, 1) : 1000 / profile.frameRate;
    lastTimestampMs = timestampMs;
    frameIndex += 1;
    void options.onFrame({
      video,
      timestampMs,
      frameIndex,
      fps: Math.round(1000 / delta),
      width: video.videoWidth || profile.width,
      height: video.videoHeight || profile.height,
    });
  };

  const scheduleFrame = () => {
    if (!running) return;

    if (typeof video.requestVideoFrameCallback === "function") {
      frameHandle = video.requestVideoFrameCallback((now, metadata) => {
        emitFrame(metadata?.mediaTime ? metadata.mediaTime * 1000 : now);
        scheduleFrame();
      });
      return;
    }

    animationHandle = window.requestAnimationFrame((now) => {
      emitFrame(now);
      scheduleFrame();
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
      facingMode: profile.facingMode,
      width: { ideal: profile.width },
      height: { ideal: profile.height },
      frameRate: { ideal: profile.frameRate, max: profile.frameRate },
    },
  });

  return {
    async start(nextPreset?: CameraPreset) {
      if (nextPreset) {
        profile = CAMERA_PROFILES[nextPreset];
      }

      stopScheduling();
      stopTracks();

      stream = await navigator.mediaDevices.getUserMedia(buildConstraints());
      const track = stream.getVideoTracks()[0];
      track?.addEventListener("ended", () => {
        running = false;
        stopScheduling();
        options.onDisconnect?.();
      });

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      running = true;
      frameIndex = 0;
      lastTimestampMs = 0;
      scheduleFrame();

      return {
        profile,
        settings: track?.getSettings?.() ?? {},
      };
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
