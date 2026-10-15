"use client";
import { useEffect, useRef } from "react";
import { loadPostureArtifact, predictPostureArtifact } from "@/lib/pose/ml/artifact";
import type { TimedLandmarks } from "@/lib/pose/ml/features";
import type { ExerciseId } from "@/lib/pose/types";
export function usePostureModel(exercise: ExerciseId) {
  const model = useRef<Awaited<ReturnType<typeof loadPostureArtifact>>>(null);
  const frames = useRef<TimedLandmarks[]>([]);
  useEffect(() => {
    let active=true; model.current=null;frames.current=[];
    if(exercise==="squat" || exercise==="bicep_curl") void loadPostureArtifact(exercise).then(result=>{if(active) model.current=result;}).catch(()=>{});
    return ()=>{active=false;};
  },[exercise]);
  return {
    reset:()=>{frames.current=[];},
    predict:(frame:TimedLandmarks)=>{
      if(!model.current) return null;
      if(frames.current.length && frame.timestampMs-frames.current.at(-1)!.timestampMs>1000) frames.current=[];
      frames.current=[...frames.current.filter(f=>frame.timestampMs-f.timestampMs<=2000),frame];
      try{return predictPostureArtifact(model.current.artifact,frames.current,model.current.mode);}catch{return null;}
    },
  };
}
