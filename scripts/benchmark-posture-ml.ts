import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildBenchmarkDatasetManifest,
  runPostureBenchmark,
  serializeBenchmarkReport,
  type BenchmarkSample,
} from "../src/lib/pose/ml/benchmark";
import { evaluatePostureMl } from "../src/lib/pose/ml/evaluator";

type BenchmarkFixture = {
  manifest: Parameters<typeof buildBenchmarkDatasetManifest>[0];
  samples: BenchmarkSample[];
};

function parseArgs() {
  const args = new Map<string, string>();
  process.argv.slice(2).forEach((arg, index, list) => {
    if (arg.startsWith("--")) {
      args.set(arg.slice(2), list[index + 1] ?? "");
    }
  });
  return {
    input: args.get("input"),
    output: args.get("output") ?? "reports/posture-benchmark.md",
  };
}

function main() {
  const args = parseArgs();
  if (!args.input) {
    throw new Error("Usage: npm run ml:benchmark -- --input fixtures/posture-benchmark.json --output reports/posture-benchmark.md");
  }

  const fixture = JSON.parse(readFileSync(resolve(args.input), "utf8")) as BenchmarkFixture;
  const manifest = buildBenchmarkDatasetManifest(fixture.manifest);
  const report = runPostureBenchmark({
    manifest,
    samples: fixture.samples,
    evaluators: {
      ml: (sample) =>
        evaluatePostureMl({
          exerciseId: sample.exerciseId,
          phase: "diagnostic",
          landmarkWindow: sample.frames.map((frame) => frame.landmarks),
          confidence: 0.96,
        }),
    },
  });
  const outputPath = resolve(args.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serializeBenchmarkReport(report));
  console.log(`Wrote benchmark report to ${outputPath}`);
}

main();
