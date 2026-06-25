import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { adaptMediapipeLandmarkRow, extractPostureFeatures } from "../src/lib/pose/ml/evaluator";
import type { MlExerciseId, PostureMistakeClass } from "../src/lib/pose/ml/types";

type TrainingRow = {
  exerciseId: MlExerciseId;
  label: PostureMistakeClass;
  values: Record<string, number>;
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
    output: args.get("output") ?? "public/posture-models/research-grade-centroids.json",
    exerciseId: (args.get("exercise") ?? "squat") as MlExerciseId,
    labelColumn: args.get("label-column") ?? "label",
  };
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((value) => value.trim());
}

function readRows(path: string) {
  const raw = readFileSync(path, "utf8").trim();
  if (!raw) return [];
  if (path.endsWith(".jsonl")) {
    return raw.split(/\r?\n/).map((line) => JSON.parse(line) as Record<string, string | number>);
  }
  const [headerLine, ...lines] = raw.split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])) as Record<string, string | number>;
  });
}

function vectorAverage(rows: TrainingRow[]) {
  const names = Object.keys(rows[0]?.values ?? {});
  return Object.fromEntries(
    names.map((name) => [name, rows.reduce((sum, row) => sum + (row.values[name] ?? 0), 0) / Math.max(rows.length, 1)]),
  );
}

function main() {
  const args = parseArgs();
  if (!args.input) {
    throw new Error("Usage: npm run ml:train -- --input dataset.csv --exercise squat --label-column label");
  }

  const rows = readRows(resolve(args.input));
  const trainingRows = rows
    .map((row) => {
      const label = String(row[args.labelColumn] ?? "") as PostureMistakeClass;
      if (!label) return null;
      const sample = adaptMediapipeLandmarkRow(row, { exerciseId: args.exerciseId, label });
      const features = extractPostureFeatures({
        exerciseId: sample.exerciseId,
        phase: "unknown",
        landmarkWindow: [sample.landmarks],
        confidence: sample.landmarks.reduce((sum, landmark) => sum + (landmark.visibility ?? 0), 0) / sample.landmarks.length,
      });
      return {
        exerciseId: sample.exerciseId,
        label,
        values: features.values,
      };
    })
    .filter((row): row is TrainingRow => Boolean(row));

  const byLabel = trainingRows.reduce((map, row) => {
    const current = map.get(row.label) ?? [];
    current.push(row);
    map.set(row.label, current);
    return map;
  }, new Map<PostureMistakeClass, TrainingRow[]>());

  const artifact = {
    version: `public-centroid-${new Date().toISOString().slice(0, 10)}`,
    modelType: "centroid_classifier",
    exerciseId: args.exerciseId,
    clinicalClaim: "not_medical_device",
    sampleCount: trainingRows.length,
    labels: Array.from(byLabel.keys()),
    featureNames: Object.keys(trainingRows[0]?.values ?? {}),
    centroids: Object.fromEntries(Array.from(byLabel.entries()).map(([label, group]) => [label, vectorAverage(group)])),
    limitation: "Public dataset artifact only; local laptop-webcam validation is required before stronger accuracy claims.",
  };

  const outputPath = resolve(args.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`Wrote ${artifact.sampleCount} samples to ${outputPath}`);
}

main();
