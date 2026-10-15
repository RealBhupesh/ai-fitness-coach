import { expect,it } from "vitest";
import { angle,toAnalysisLandmarks } from "./math";
import { buildTrackingFrame } from "./confidence";
it("preserves pixel-space joint angles across landscape, square and portrait images",()=>{
 const geometry=[{x:0.1,y:0.2,visibility:1},{x:0.2,y:0.3,visibility:1},{x:0.3,y:0.2,visibility:1}];
 for(const ratio of [16/9,1,9/16]){
  const raw=geometry.map(p=>({...p,x:p.x/ratio}));
  const metric=toAnalysisLandmarks(raw,ratio);expect(angle(metric[0],metric[1],metric[2])).toBeCloseTo(90,6);
  expect(raw[0].x).toBeCloseTo(geometry[0].x/ratio,6);
 }
});
it("retains raw drawing coordinates alongside isotropic analysis points",()=>{
 const raw=Array.from({length:33},()=>({x:0.5,y:0.5,z:0,visibility:0.95}));
 const frame=buildTrackingFrame({exerciseId:"squat",rawLandmarks:raw,previousSmoothed:null,imageAspectRatio:16/9,timestampMs:1000,frameIndex:1,fps:30,brightness:100});
 expect(frame.smoothedLandmarks[0].x).toBe(0.5);expect(frame.analysisLandmarks?.[0].x).toBeCloseTo(8/9);expect(frame.imageAspectRatio).toBeCloseTo(16/9);
});
it("rejects unusable image dimensions",()=>{expect(()=>toAnalysisLandmarks([],0)).toThrow();expect(()=>toAnalysisLandmarks([],Infinity)).toThrow();});
