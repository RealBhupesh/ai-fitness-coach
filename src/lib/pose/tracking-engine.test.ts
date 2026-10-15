import { afterEach, describe, expect, it, vi } from "vitest";
import { createPoseTrackingEngine } from "./tracking-engine";
describe("worker inference bridge",()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it("retries the lite model after full initialization fails",async()=>{
  const qualities:string[]=[];const terminate=vi.fn();
  class TestWorker {
   onmessage:((event:{data:unknown})=>void)|null=null;onerror:unknown;
   terminate=terminate;
   postMessage(message:{id:number;type:string;quality?:string}) {
    if(message.quality)qualities.push(message.quality);
    queueMicrotask(()=>this.onmessage?.({data:{id:message.id,...(message.quality==="full"?{error:"Full asset unavailable"}:message.type==="frame"?{landmarks:[],latencyMs:10}:{})}}));
   }
  }
  vi.stubGlobal("Worker",TestWorker);vi.stubGlobal("window",{location:{origin:"https://test.example"}});
  vi.stubGlobal("createImageBitmap",vi.fn(async()=>({close:vi.fn()})));
  const engine=createPoseTrackingEngine({});
  const frame={video:{} as HTMLVideoElement,timestampMs:1000,frameIndex:1,fps:30};
  expect(await engine.processFrame(frame,"squat")).toBeNull();expect(qualities).toEqual(["full","lite"]);
  await engine.stop();expect(terminate).toHaveBeenCalledOnce();
 });
 it("keeps one initialization in flight and does not restart after stopping",async()=>{
  const messages:unknown[]=[];
  class TestWorker {onmessage:unknown;onerror:unknown;terminate=vi.fn();postMessage(message:unknown){messages.push(message);}}
  vi.stubGlobal("Worker",TestWorker);vi.stubGlobal("window",{location:{origin:"https://test.example"}});
  const engine=createPoseTrackingEngine({});const frame={video:{} as HTMLVideoElement,timestampMs:1000,frameIndex:1,fps:30};
  const first=engine.processFrame(frame,"squat");const rejected=expect(first).rejects.toThrow("stopped");
  expect(await engine.processFrame(frame,"squat")).toBeNull();expect(messages).toHaveLength(1);
  await engine.stop();await rejected;expect(messages).toHaveLength(1);
 });
});
