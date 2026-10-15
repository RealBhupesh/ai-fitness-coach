import { expect,test } from "@playwright/test";
test("deployed classic worker loads its model and returns a frame result",async({page})=>{
 await page.goto("/login",{waitUntil:"domcontentloaded"});
 const result=await page.evaluate(async()=>{
  const worker=new Worker("/mediapipe/pose-worker.js");let id=0;
  const request=(message:Record<string,unknown>,transfer:Transferable[]=[])=>new Promise<any>((resolve,reject)=>{
   const requestId=++id;const timer=setTimeout(()=>reject(new Error("Worker deadline exceeded")),45000);
   worker.onerror=event=>{clearTimeout(timer);reject(new Error(event.message));};
   worker.onmessage=event=>{if(event.data.id!==requestId)return;clearTimeout(timer);if(event.data.error)reject(new Error(event.data.error));else resolve(event.data);};
   worker.postMessage({...message,id:requestId},transfer);
  });
  try {
   await request({type:"init",quality:"full",origin:location.origin});
   const canvas=document.createElement("canvas");canvas.width=128;canvas.height=128;
   const context=canvas.getContext("2d")!;context.fillStyle="#999";context.fillRect(0,0,128,128);
   const bitmap=await createImageBitmap(canvas);
   const reply=await request({type:"frame",bitmap,timestampMs:performance.now()},[bitmap]);
   return {landmarks:Array.isArray(reply.landmarks),worldLandmarks:Array.isArray(reply.worldLandmarks),brightness:reply.brightness,latencyMs:reply.latencyMs};
  } finally {worker.terminate();}
 });
 expect(result.landmarks).toBe(true);expect(result.worldLandmarks).toBe(true);expect(result.brightness).toBeGreaterThan(100);expect(result.latencyMs).toBeGreaterThanOrEqual(0);
});
