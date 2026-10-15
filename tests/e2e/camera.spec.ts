import { expect,test } from "@playwright/test";
test.use({launchOptions:{args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream","--disable-gpu"]},permissions:["camera"],trace:"off"});
test("worker initializes with GPU disabled, transfers frames, and releases camera",async({page,baseURL})=>{
 test.skip(process.env.E2E_REAL_DATABASE!=="true"||!!process.env.PLAYWRIGHT_USE_BUILD,"Requires isolated database and local auth");
 test.setTimeout(180000);
 const origin=new URL(baseURL||"http://127.0.0.1:3100").origin;
 const signup=await page.request.post("/api/auth/sign-up/email",{headers:{origin},data:{email:`camera-${crypto.randomUUID()}@example.test`,password:"Test-only-fitness-123!",name:"Camera Test"}});expect(signup.ok()).toBeTruthy();
 page.on("pageerror",error=>console.log("camera browser error:",error.message.slice(0,300)));
 page.on("console",message=>{if(message.type()==="error" && /worker|mediapipe|wasm/i.test(message.text()))console.log("camera console error:",message.text().slice(0,300));});
 try {
  await page.addInitScript(()=>{
   const state={initialized:false,frames:0,error:"",inFlight:0,maxInFlight:0,tracks:[] as MediaStreamTrack[]};
   (window as any).__cameraCheck=state;
   const NativeWorker=window.Worker;
   window.Worker=class extends NativeWorker {
    constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.addEventListener("error",event=>{state.error=`${event.message} at ${event.filename}:${event.lineno}`;});this.addEventListener("message",event=>{state.inFlight--;if(event.data.error)state.error=event.data.error;else if(event.data.landmarks)state.frames++;else state.initialized=true;});}
    postMessage(message:any,transfer?:any){state.inFlight++;state.maxInFlight=Math.max(state.maxInFlight,state.inFlight);super.postMessage(message,transfer);}
   };
   const getUserMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
   navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await getUserMedia(constraints);state.tracks.push(...stream.getTracks());return stream;};
  });
  await page.goto("/coach/workout",{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"Enable camera",exact:true}).click();
  await page.waitForFunction(()=>{const s=(window as any).__cameraCheck;return s.frames>1 || !!s.error;},{},{timeout:60000});
  const state=await page.evaluate(()=>{const s=(window as any).__cameraCheck;return {initialized:s.initialized,error:s.error,maxInFlight:s.maxInFlight,frames:s.frames};});
  expect(state.error).toBe("");expect(state.initialized).toBe(true);expect(state.maxInFlight).toBe(1);expect(state.frames).toBeGreaterThan(1);
  await page.locator('a[href="/dashboard"]').first().click();
  await expect(page).toHaveURL(/\/dashboard$/,{timeout:30000});
  expect(await page.evaluate(()=>(window as any).__cameraCheck.tracks.length)).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>(window as any).__cameraCheck.tracks.every((t:MediaStreamTrack)=>t.readyState==="ended"))).toBe(true);
 } finally {
  await test.info().attach("camera-state",{body:JSON.stringify(await page.evaluate(()=>{
   const s=(window as any).__cameraCheck;const video=document.querySelector("video");return {initialized:s?.initialized,frames:s?.frames,error:s?.error,inFlight:s?.inFlight,maxInFlight:s?.maxInFlight,tracks:s?.tracks.map((t:MediaStreamTrack)=>t.readyState),hidden:document.hidden,video:video?{paused:video.paused,time:video.currentTime,width:video.videoWidth}:null};
  })),contentType:"application/json"});
  const cleanup=page.request;await page.close();
  await cleanup.delete("/api/account",{headers:{origin},data:{confirmation:"DELETE"}});
 }
});

// Synthetic geometry isolates preview lifecycle; it is not form-accuracy evidence.
test("preview layout, PiP and minimization preserve capture and save on navigation",async({page,baseURL})=>{
 test.skip(process.env.E2E_REAL_DATABASE!=="true"||!!process.env.PLAYWRIGHT_USE_BUILD,"Requires isolated database and local auth");
 test.setTimeout(180000);
 const origin=new URL(baseURL||"http://127.0.0.1:3100").origin;
 const signup=await page.request.post("/api/auth/sign-up/email",{headers:{origin},data:{email:`preview-${crypto.randomUUID()}@example.test`,password:"Test-only-fitness-123!",name:"Preview Test"}});expect(signup.ok()).toBeTruthy();
 try {
  await page.addInitScript(()=>{
   const state={frames:0,tracks:[] as MediaStreamTrack[]};(window as any).__previewCheck=state;
   const NativeWorker=window.Worker;
   window.Worker=class {
    onmessage:((event:any)=>void)|null=null;onerror=null;
    constructor(url:string|URL,options?:WorkerOptions){if(!String(url).includes("/mediapipe/pose-worker.js"))return new NativeWorker(url,options) as any;}
    postMessage(message:any){
     message.bitmap?.close();
     if(message.type==="init"){queueMicrotask(()=>this.onmessage?.({data:{id:message.id}}));return;}
     const landmarks=Array.from({length:33},()=>({x:0.5,y:0.15,z:0,visibility:0.99}));
     for(const [index,x,y] of [[11,.40,.30],[12,.60,.30],[13,.40,.44],[14,.60,.44],[15,.40,.61],[16,.60,.61],[23,.42,.52],[24,.58,.52],[25,.42,.72],[26,.58,.72],[27,.42,.90],[28,.58,.90],[29,.42,.92],[30,.58,.92],[31,.42,.94],[32,.58,.94]]){landmarks[index]={x,y,z:0,visibility:.99};}
     state.frames++;queueMicrotask(()=>this.onmessage?.({data:{id:message.id,landmarks,worldLandmarks:[],brightness:120,latencyMs:2}}));
    }
    terminate(){}
   } as any;
   const getUserMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
   navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await getUserMedia(constraints);state.tracks.push(...stream.getTracks());return stream;};
  });
  await page.goto("/coach/workout",{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"Enable camera",exact:true}).click();
  const start=page.getByRole("button",{name:"Start session",exact:true});await expect(start).toBeEnabled({timeout:30000});await start.click();
  const preview=page.getByTestId("camera-preview");
  await page.evaluate(()=>{(window as any).__previewVideo=document.querySelector("video");});
  await preview.getByRole("button",{name:"Layout",exact:true}).click();
  await expect(preview.locator("video")).toHaveCSS("object-fit","contain");
  await expect(page.getByTestId("pose-overlay")).toHaveCSS("object-fit","contain");
  await preview.getByRole("button",{name:"PiP",exact:true}).click();
  await page.getByRole("button",{name:"Minimize camera preview",exact:true}).click();
  const before=await page.evaluate(()=>(window as any).__previewCheck.frames);
  await expect.poll(()=>page.evaluate(()=>(window as any).__previewCheck.frames)).toBeGreaterThan(before+3);
  await page.getByRole("button",{name:"Restore camera",exact:true}).click();
  expect(await page.evaluate(()=>document.querySelector("video")===(window as any).__previewVideo)).toBe(true);
  expect(await page.evaluate(()=>(window as any).__previewCheck.tracks.every((track:MediaStreamTrack)=>track.readyState==="live"))).toBe(true);
  const saving=page.waitForResponse(response=>response.url().endsWith("/api/workouts")&&response.request().method()==="POST",{timeout:30000});
  await page.locator('a[href="/dashboard"]').first().click();
  const saved=await saving;expect(saved.ok(),await saved.text()).toBe(true);
  await expect(page).toHaveURL(/\/dashboard$/,{timeout:30000});
  await expect.poll(async()=>{const response=await page.request.get("/api/workouts");return (await response.json()).workouts?.length||0;},{timeout:30000}).toBe(1);
  await expect.poll(()=>page.evaluate(()=>(window as any).__previewCheck.tracks.every((track:MediaStreamTrack)=>track.readyState==="ended"))).toBe(true);
 } finally {test.setTimeout(test.info().timeout+30000);const cleanup=page.request;await page.close();await cleanup.delete("/api/account",{headers:{origin},data:{confirmation:"DELETE"}});}
});
