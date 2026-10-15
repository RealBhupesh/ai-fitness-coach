import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { toAnalysisLandmarks } from "../src/lib/pose/math";
import { temporalFeatures, FEATURE_NAMES, FEATURE_VERSION } from "../src/lib/pose/ml/features";
import { advancePhaseTracker, createPhaseTrackerState } from "../src/lib/pose/exercises";
import { evaluatePostureMl } from "../src/lib/pose/ml/evaluator";
import { z } from "zod";
const rowSchema = z.object({ synthetic:z.boolean().default(false),normalization:z.record(z.string(),z.unknown()).optional(),sourceId:z.string().min(1),subjectId:z.string().min(1),videoId:z.string().min(1),exerciseId:z.enum(["squat","bicep_curl"]),exerciseVariant:z.string().min(1).max(120),faults:z.array(z.string()),frames:z.array(z.object({timestampMs:z.number().nonnegative(),aspectRatio:z.number().positive().max(10),landmarks:z.array(z.object({x:z.number().finite(),y:z.number().finite(),z:z.number().finite().optional(),visibility:z.number().min(0).max(1)})).length(33)})).min(2) });
const args=process.argv.slice(2);const value=(key:string)=>args[args.indexOf(key)+1];
if(!args.includes("--input")||!args.includes("--output")) throw new Error("Usage: tsx scripts/prepare-posture-data.ts --input sequences.jsonl --output features.jsonl");
const rows=readFileSync(value("--input"),"utf8").trim().split(/\r?\n/).filter(Boolean).map(line=>rowSchema.parse(JSON.parse(line)));
// Connected source/participant groups are assigned before generating any windows.
const parent=new Map<string,string>();
const root=(key:string):string=>{if(!parent.has(key))parent.set(key,key);const p=parent.get(key)!;if(p!==key)parent.set(key,root(p));return parent.get(key)!;};
for(const row of rows) parent.set(root(`subject:${row.subjectId}`),root(`video:${row.videoId}`));
const groupHash=(group:string)=>createHash("sha256").update(`fitcoach-split-v1:${group}`).digest("hex");
const groups=[...new Set(rows.map(row=>root(`subject:${row.subjectId}`)))].sort((a,b)=>groupHash(a).localeCompare(groupHash(b)));
if(groups.length<5) throw new Error("At least five independent participant/video groups required");
const splits=new Map(groups.map((group,i)=>[group,i<Math.floor(groups.length*0.6)?"train":i<Math.floor(groups.length*0.8)?"validation":"test"]));
const output=rows.flatMap(row=>{
 let state=createPhaseTrackerState();let previousTime:number|undefined;
 const frames=[...row.frames].sort((a,b)=>a.timestampMs-b.timestampMs).map(frame=>{
  if(previousTime!==undefined && frame.timestampMs-previousTime>1000)state=createPhaseTrackerState();
  const landmarks=toAnalysisLandmarks(frame.landmarks,frame.aspectRatio);
  state=advancePhaseTracker(row.exerciseId,landmarks,state,frame.timestampMs).state;
  previousTime=frame.timestampMs;return {...frame,landmarks,phase:state.phase};
 });
 const windows=[];
 for(let start=frames[0].timestampMs;start+500<=frames.at(-1)!.timestampMs;start+=500){
  const window=frames.filter(f=>f.timestampMs>=start&&f.timestampMs<=start+2000);
  if(window.length<2||window.at(-1)!.timestampMs-window[0].timestampMs<500)continue;
  const features=temporalFeatures(window,row.exerciseId);
  if(features[10]<0.65)continue;
  const baseline=evaluatePostureMl({exerciseId:row.exerciseId,phase:window.at(-1)!.phase,landmarkWindow:window.filter(f=>window.at(-1)!.timestampMs-f.timestampMs<=1000).map(f=>f.landmarks),confidence:features[10]});
  windows.push({synthetic:row.synthetic,normalization:row.normalization,sourceId:row.sourceId,subjectId:row.subjectId,videoId:row.videoId,exerciseId:row.exerciseId,exerciseVariant:row.exerciseVariant,faults:row.faults,split:splits.get(root(`subject:${row.subjectId}`)),featureVersion:FEATURE_VERSION,featureNames:FEATURE_NAMES,features,baselineFaults:Object.entries(baseline.mistakeProbabilities).filter(([key,n])=>key!=="clean"&&n>=0.5).map(([key])=>key)});
 }
 return windows;
});
if(!output.length)throw new Error("No usable labeled windows");
writeFileSync(value("--output"),output.map(row=>JSON.stringify(row)).join("\n")+"\n");
console.log(`Prepared ${output.length} windows from ${groups.length} independent groups.`);
