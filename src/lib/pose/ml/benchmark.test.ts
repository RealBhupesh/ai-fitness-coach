import { describe, expect, it } from "vitest";
import {
  buildBenchmarkDatasetManifest,
  extractTemporalPostureFeatures,
  runPostureBenchmark,
  serializeBenchmarkReport,
} from "@/lib/pose/ml/benchmark";
import { evaluatePostureMl } from "@/lib/pose/ml/evaluator";
import type { Landmark } from "@/lib/pose/types";

function baseLandmarks() {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.96 })) as Landmark[];
}

function squatFrame(kind: "top" | "bottom_clean" | "bottom_collapse", timestampMs: number) {
  const landmarks = baseLandmarks();
  const bottom = kind !== "top";
  landmarks[11] = { x: 0.42, y: 0.28, visibility: 0.96 };
  landmarks[12] = { x: 0.58, y: 0.28, visibility: 0.96 };
  landmarks[23] = { x: 0.43, y: bottom ? 0.62 : 0.48, visibility: 0.96 };
  landmarks[24] = { x: 0.57, y: bottom ? 0.62 : 0.48, visibility: 0.96 };
  landmarks[25] = { x: kind === "bottom_collapse" ? 0.49 : 0.43, y: bottom ? 0.72 : 0.66, visibility: 0.96 };
  landmarks[26] = { x: kind === "bottom_collapse" ? 0.51 : 0.57, y: bottom ? 0.72 : 0.66, visibility: 0.96 };
  landmarks[27] = { x: bottom ? 0.31 : 0.42, y: bottom ? 0.72 : 0.86, visibility: 0.96 };
  landmarks[28] = { x: bottom ? 0.69 : 0.58, y: bottom ? 0.72 : 0.86, visibility: 0.96 };
  return { timestampMs, landmarks };
}

describe("posture benchmark lab", () => {
  it("extracts temporal features from a landmark sequence, not just one static frame", () => {
    const cleanRep = [
      squatFrame("top", 0),
      squatFrame("bottom_clean", 500),
      squatFrame("top", 1000),
    ];
    const collapsedRep = [
      squatFrame("top", 0),
      squatFrame("bottom_collapse", 500),
      squatFrame("top", 1000),
    ];

    const clean = extractTemporalPostureFeatures({ exerciseId: "squat", frames: cleanRep });
    const flawed = extractTemporalPostureFeatures({ exerciseId: "squat", frames: collapsedRep });

    expect(clean.frameCount).toBe(3);
    expect(clean.durationMs).toBe(1000);
    expect(clean.values.kneeWidthRatioMin).toBeGreaterThan(flawed.values.kneeWidthRatioMin);
    expect(clean.values.romKneeAngle).toBeGreaterThan(10);
    expect(clean.values.meanJointVelocity).toBeGreaterThan(0);
  });

  it("builds dataset manifest language for public-data and webcam validation boundaries", () => {
    const manifest = buildBenchmarkDatasetManifest({
      name: "Public squat benchmark",
      sources: ["Kaggle MediaPipe 33-landmark exercise rows", "KIMORE methodology reference"],
      subjectCount: 12,
      sampleCount: 48,
      captureDevice: "public dataset mixed cameras",
      labelProtocol: "rubric labels mapped to posture mistake classes",
    });

    expect(manifest.limitations.join(" ")).toContain("not a medical device");
    expect(manifest.limitations.join(" ")).toContain("laptop-webcam validation");
    expect(manifest.sources).toContain("KIMORE methodology reference");
  });

  it("runs a benchmark report with confusion matrix, latency, and model comparison", () => {
    const report = runPostureBenchmark({
      manifest: buildBenchmarkDatasetManifest({
        name: "Synthetic squat benchmark",
        sources: ["synthetic fixture"],
        sampleCount: 2,
        subjectCount: 1,
        captureDevice: "deterministic landmarks",
        labelProtocol: "known generated labels",
      }),
      samples: [
        {
          id: "clean-squat",
          exerciseId: "squat",
          expected: "clean",
          frames: [squatFrame("top", 0), squatFrame("bottom_clean", 500), squatFrame("top", 1000)],
        },
        {
          id: "collapse-squat",
          exerciseId: "squat",
          expected: "knee_collapse",
          frames: [squatFrame("top", 0), squatFrame("bottom_collapse", 500), squatFrame("top", 1000)],
        },
      ],
      evaluators: {
        ml: (sample) =>
          evaluatePostureMl({
            exerciseId: sample.exerciseId,
            phase: "bottom",
            landmarkWindow: sample.frames.map((frame) => frame.landmarks),
            confidence: 0.96,
          }),
      },
    });

    expect(report.sampleCount).toBe(2);
    expect(report.models.ml.accuracy).toBeGreaterThanOrEqual(0.5);
    expect(report.models.ml.confusionMatrix.knee_collapse?.knee_collapse).toBe(1);
    expect(report.models.ml.averageLatencyMs).toBeGreaterThanOrEqual(0);
    expect(report.recommendation).toContain("local webcam");
  });

  it("serializes a professor-friendly benchmark artifact", () => {
    const report = runPostureBenchmark({
      manifest: buildBenchmarkDatasetManifest({
        name: "Synthetic squat benchmark",
        sources: ["synthetic fixture"],
        sampleCount: 1,
        subjectCount: 1,
        captureDevice: "deterministic landmarks",
        labelProtocol: "known generated labels",
      }),
      samples: [
        {
          id: "collapse-squat",
          exerciseId: "squat",
          expected: "knee_collapse",
          frames: [squatFrame("top", 0), squatFrame("bottom_collapse", 500), squatFrame("top", 1000)],
        },
      ],
      evaluators: {
        ml: (sample) =>
          evaluatePostureMl({
            exerciseId: sample.exerciseId,
            phase: "bottom",
            landmarkWindow: sample.frames.map((frame) => frame.landmarks),
            confidence: 0.96,
          }),
      },
    });

    const artifact = serializeBenchmarkReport(report);

    expect(artifact).toContain("# Posture Benchmark Report");
    expect(artifact).toContain("not a medical device");
    expect(artifact).toContain("Confusion Matrix");
  });
});
