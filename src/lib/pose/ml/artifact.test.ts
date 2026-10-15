import { describe, expect, it } from "vitest";
import { canPromoteModel,postureArtifactSchema,type PostureArtifact } from "@/lib/pose/ml/artifact";
import { FEATURE_NAMES } from "@/lib/pose/ml/features";
function artifact():PostureArtifact{return {version:"test-only",featureVersion:"temporal-v2",modelType:"calibrated_logistic",exerciseId:"squat",featureNames:[...FEATURE_NAMES],mean:Array(12).fill(0),scale:Array(12).fill(1),provenance:{sources:["test fixture"],deploymentPermitted:true,synthetic:false,labelProtocol:"Test fixture only",splitHash:"test"},classifiers:[{fault:"squat_depth",weights:Array(12).fill(0),bias:0,calibrationA:1,calibrationB:0,threshold:0.9}],evaluation:{macroF1:0.9,baselineMacroF1:0.85,calibrationError:0.05,precision:{squat_depth:0.95},samplesPerFault:{squat_depth:150},subjectCount:10,cameraValidation:{laptop:true,androidLow:true,androidMid:true,evidenceId:"test-fixture"}}};}
describe("learned model promotion",()=>{
 it("requires camera evidence, representative support, calibration and baseline parity",()=>{
  const model=artifact();expect(canPromoteModel(model)).toBe(true);
  model.evaluation.cameraValidation.androidLow=false;expect(canPromoteModel(model)).toBe(false);
  model.evaluation.cameraValidation.androidLow=true;model.evaluation.samplesPerFault.squat_depth=5;expect(canPromoteModel(model)).toBe(false);
  model.evaluation.samplesPerFault.squat_depth=150;model.evaluation.baselineMacroF1=0.95;expect(canPromoteModel(model)).toBe(false);
 });
 it("rejects research-only, synthetic and incompatible artifacts",()=>{
  const model=artifact();expect(postureArtifactSchema.safeParse({...model,provenance:{...model.provenance,deploymentPermitted:false}}).success).toBe(false);
  expect(postureArtifactSchema.safeParse({...model,featureNames:[...FEATURE_NAMES].reverse()}).success).toBe(false);
 });
});
