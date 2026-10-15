import { z } from "zod";
import { FEATURE_NAMES, FEATURE_VERSION, temporalFeatures, type TimedLandmarks } from "@/lib/pose/ml/features";
import type { MlExerciseId, PostureMistakeClass, PostureMlPrediction } from "@/lib/pose/ml/types";
const finite = z.number().finite();
const weights = z.array(finite).length(FEATURE_NAMES.length);
export const postureArtifactSchema = z.object({
  version: z.string().min(1).max(120), featureVersion: z.literal(FEATURE_VERSION), modelType: z.literal("calibrated_logistic"), exerciseId: z.enum(["squat", "bicep_curl"]),
  featureNames: z.array(z.string()).length(FEATURE_NAMES.length), mean: weights, scale: weights.refine(v=>v.every(n=>n>0)),
  provenance: z.object({ sources: z.array(z.string().min(1)).min(1), deploymentPermitted: z.literal(true), synthetic: z.literal(false), labelProtocol: z.string().min(1), splitHash: z.string().min(1) }),
  classifiers: z.array(z.object({ fault: z.enum(["squat_depth","knee_collapse","torso_fold","hip_shift","curl_elbow_drift","curl_shoulder_hike","curl_incomplete_rom"]), weights, bias: finite, calibrationA: finite, calibrationB: finite, threshold: finite.min(0.5).max(1) })).min(1).max(8),
  evaluation: z.object({ macroF1: finite.min(0).max(1), calibrationError: finite.min(0).max(1), baselineMacroF1: finite.min(0).max(1), precision: z.record(z.string(), finite.min(0).max(1)), samplesPerFault: z.record(z.string(), z.number().int().nonnegative()), subjectCount: z.number().int().nonnegative(), cameraValidation: z.object({ laptop: z.boolean(), androidLow: z.boolean(), androidMid: z.boolean(), evidenceId: z.string() }) }),
}).superRefine((model, ctx) => {
  if (model.featureNames.join(",") !== FEATURE_NAMES.join(",")) ctx.addIssue({ code: "custom", message: "Feature order mismatch" });
  if (new Set(model.classifiers.map(c=>c.fault)).size !== model.classifiers.length) ctx.addIssue({ code: "custom", message: "Duplicate classifier" });
  if (model.classifiers.some(c=>model.exerciseId === "squat" ? c.fault.startsWith("curl_") : !c.fault.startsWith("curl_"))) ctx.addIssue({ code: "custom", message: "Exercise fault mismatch" });
});
export type PostureArtifact = z.infer<typeof postureArtifactSchema>;
export function canPromoteModel(model: PostureArtifact) {
  const e=model.evaluation;
  return e.macroF1>=0.85 && e.macroF1>=e.baselineMacroF1 && e.calibrationError<=0.1 && e.subjectCount>=10 && model.classifiers.every(c=>(e.precision[c.fault]??0)>=0.9 && (e.samplesPerFault[c.fault]??0)>=100) && e.cameraValidation.laptop && e.cameraValidation.androidLow && e.cameraValidation.androidMid && Boolean(e.cameraValidation.evidenceId);
}
const sigmoid = (v:number) => 1/(1+Math.exp(-Math.max(-40,Math.min(40,v))));
export function predictPostureArtifact(model: PostureArtifact, frames: TimedLandmarks[], mode: "shadow" | "live"): PostureMlPrediction {
  if (mode === "live" && !canPromoteModel(model)) throw new Error("MODEL_NOT_VALIDATED");
  const raw=temporalFeatures(frames,model.exerciseId);
  const vector=raw.map((v,i)=>(v-model.mean[i])/model.scale[i]);
  const probabilities = Object.fromEntries(["clean","squat_depth","knee_collapse","torso_fold","hip_shift","curl_elbow_drift","curl_shoulder_hike","curl_wrist_fold","curl_incomplete_rom","unstable_camera"].map(k=>[k,0])) as Record<PostureMistakeClass,number>;
  for (const c of model.classifiers) probabilities[c.fault]=sigmoid(c.calibrationA*(c.bias+vector.reduce((sum,v,i)=>sum+v*c.weights[i],0))+c.calibrationB);
  const highest=Math.max(...model.classifiers.map(c=>probabilities[c.fault]));
  probabilities.clean=1-highest;
  const suppressed=raw[10]<0.65 || raw[11]<0.5;
  return { source:"learned",evaluationStatus:mode === "live" ? "validated" : "shadow",featureVersion:model.featureVersion,supportedFaults:model.classifiers.map(c=>c.fault),observedFaults:mode === "live" && !suppressed ? model.classifiers.filter(c=>probabilities[c.fault]>=c.threshold).map(c=>c.fault):[],modelVersion:model.version,modelConfidence:0,calibratedConfidence:null,predictedQuality:suppressed?0:Math.round((1-highest)*100),mistakeProbabilities:probabilities,clinicalClaim:"not_medical_device",suppressed,suppressionReason:suppressed?"Insufficient tracking or temporal evidence":undefined,evidenceFeatures:Object.fromEntries(FEATURE_NAMES.map((name,i)=>[name,raw[i]])) };
}
export async function loadPostureArtifact(exercise: MlExerciseId) {
  const mode = process.env.NEXT_PUBLIC_LEARNED_POSTURE_MODE;
  if (mode !== "shadow" && mode !== "live") return null;
  const response=await fetch("/posture-models/manifest.json",{cache:"no-store"});
  if (!response.ok) return null;
  const manifest=await response.json();
  const entry=manifest.exercises?.[exercise];
  if (!entry?.enabled || typeof entry.path!=="string" || !/^\/posture-models\/[a-zA-Z0-9._-]+\.json$/.test(entry.path)) return null;
  const artifactResponse=await fetch(entry.path,{cache:"no-store"});
  if(!artifactResponse.ok) return null;
  const parsed=postureArtifactSchema.safeParse(await artifactResponse.json());
  if(!parsed.success || parsed.data.exerciseId!==exercise || (mode==="live" && !canPromoteModel(parsed.data))) return null;
  return { artifact:parsed.data, mode } as const;
}
