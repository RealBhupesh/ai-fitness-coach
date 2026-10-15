import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { z } from "zod";

const args=process.argv.slice(2);
const option=name=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
const schema=z.object({sourceId:z.string().min(1),subjectId:z.string().min(1),videoId:z.string().min(1),exerciseId:z.enum(["squat","bicep_curl"]),exerciseVariant:z.string().min(1),faults:z.array(z.string()),videoPath:z.string().min(1),startMs:z.number().nonnegative().default(0),endMs:z.number().positive()});
const staticFiles=new Set(["pose-worker.js","models/pose_landmarker_full.task","models/pose_landmarker_lite.task",...['vision_wasm_internal','vision_wasm_module_internal','vision_wasm_nosimd_internal'].flatMap(name=>['wasm/'+name+'.js','wasm/'+name+'.wasm'])]);

async function main(){
 const input=option('--input'),manifestPath=option('--manifest'),output=option('--output');
 if(!input||!manifestPath||!output)throw new Error('Usage: npm run ml:extract -- --input clips.json --manifest manifest.json --output datasets/landmarks.jsonl [--fps 10]');
 const fps=Number(option('--fps')||10);if(!Number.isFinite(fps)||fps<1||fps>30)throw new Error('Sampling FPS must be between 1 and 30');
 if(resolve(output).split(/[\\/]/).some(part=>part.toLowerCase()==='public'))throw new Error('Dataset outputs must remain outside public assets');
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 const fixture=args.includes('--fixture');
 if(fixture?manifest.synthetic!==true:manifest.synthetic!==false)throw new Error('Explicit synthetic provenance required; fixtures need --fixture and cannot train models');
 const clips=z.array(schema).min(1).max(5000).parse(JSON.parse(await readFile(input,'utf8')));
 const sources=new Map((manifest.sources||[]).map(source=>[source.id,source]));
 for(const clip of clips){
  if(clip.endMs<=clip.startMs||clip.endMs-clip.startMs>300000)throw new Error('Use continuously labelled clips of at most five minutes');
  const source=sources.get(clip.sourceId);
  if(!source||source.type!==(fixture?'synthetic_fixture':'public')||!source.url||!source.license||!source.permittedUses?.includes('research'))throw new Error('Admitted public source, license and permitted research use required');
  const recording=manifest.recordings?.find(row=>row.sourceId===clip.sourceId&&row.videoId===clip.videoId);
  if(!manifest.subjects?.includes(clip.subjectId)||!recording?.subjectIds?.includes(clip.subjectId)||!manifest.exerciseVariants?.[clip.exerciseId]?.includes(clip.exerciseVariant)||!recording.exerciseVariants?.[clip.exerciseId]?.includes(clip.exerciseVariant))throw new Error('Recording, participant or variant provenance mismatch');
  if(clip.faults.some(fault=>!manifest.labelDefinitions?.[fault]))throw new Error('Published fault definitions required');
  clip.videoPath=resolve(dirname(resolve(input)),clip.videoPath);
  if(!['.mp4','.m4v','.webm'].includes(extname(clip.videoPath).toLowerCase())||!(await stat(clip.videoPath)).isFile())throw new Error('Use an existing MP4 or WebM recording');
 }
 await stat('public/mediapipe/pose-worker.js');
 const modelBytes=await readFile('public/mediapipe/models/pose_landmarker_full.task');
 const modelSha256=createHash('sha256').update(modelBytes).digest('hex');
 const sdk=JSON.parse(await readFile('node_modules/@mediapipe/tasks-vision/package.json','utf8')).version;
 const server=createServer(async(req,res)=>{
  try{
   if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
   const url=new URL(req.url||'/','http://127.0.0.1');
   if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end('<!doctype html><html><body><video muted preload="auto" playsinline></video></body></html>');return;}
   const video=url.pathname.match(/^\/video\/([0-9]+)$/);
   let file;
   if(video){file=clips[Number(video[1])]?.videoPath;}
   else if(url.pathname.startsWith('/mediapipe/')){const asset=url.pathname.slice('/mediapipe/'.length);if(staticFiles.has(asset))file=resolve('public/mediapipe',asset);}
   if(!file){res.writeHead(404).end();return;}
   const info=await stat(file);let start=0,end=info.size-1,status=200;
   const range=req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
   if(req.headers.range&&!range){res.writeHead(416).end();return;}
   if(range){start=range[1]?Number(range[1]):Math.max(0,info.size-Number(range[2]));end=range[1]&&range[2]?Math.min(Number(range[2]),end):end;status=206;}
   if(start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
   const extension=extname(file).toLowerCase();
   const type={'.js':'application/javascript','.wasm':'application/wasm','.mp4':'video/mp4','.m4v':'video/mp4','.webm':'video/webm'}[extension]||'application/octet-stream';
   res.writeHead(status,{'Content-Type':type,'Content-Length':end-start+1,'Accept-Ranges':'bytes',...(status===206?{'Content-Range':`bytes ${start}-${end}/${info.size}`}:{})});
   if(req.method==='HEAD'){res.end();return;}
   const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
  }catch{if(!res.headersSent)res.writeHead(500);res.end();}
 });
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
 let browser;
 try{
  browser=await chromium.launch();const page=await browser.newPage();
  const origin=`http://127.0.0.1:${server.address().port}`;await page.goto(origin);await page.bringToFront();
  const records=[];let outputBytes=0;
  for(const [index,clip] of clips.entries()){
   const frames=await page.evaluate(async({index,startMs,endMs,fps})=>{
    const video=document.querySelector('video');const worker=new Worker('/mediapipe/pose-worker.js');let id=0;
    const request=(message,transfer=[])=>new Promise((ok,fail)=>{
     const current=++id;const timer=setTimeout(()=>fail(new Error('Pose worker deadline exceeded')),45000);
     worker.onerror=event=>{clearTimeout(timer);fail(new Error(event.message));};
     worker.onmessage=event=>{if(event.data.id!==current)return;clearTimeout(timer);if(event.data.error)fail(new Error(`Pose ${message.type} failed: ${event.data.error}`));else ok(event.data);};
     worker.postMessage({...message,id:current},transfer);
    });
    const waitVideo=event=>new Promise((ok,fail)=>{
     const timer=setTimeout(()=>{cleanup();fail(new Error('Video decode deadline exceeded'));},15000);
     const cleanup=()=>{clearTimeout(timer);video.removeEventListener(event,ready);video.removeEventListener('error',error);};
     const ready=()=>{cleanup();ok();};const error=()=>{cleanup();fail(new Error('Video codec unavailable; convert the public recording to MP4/H.264 or WebM first'));};
     video.addEventListener(event,ready,{once:true});video.addEventListener('error',error,{once:true});
    });
    try{
     const loaded=waitVideo('loadeddata');video.src=`/video/${index}`;video.load();await loaded;
     await request({type:'init',quality:'full',origin:location.origin});
     const end=Math.min(endMs,Number.isFinite(video.duration)?video.duration*1000:endMs);const frames=[];
     for(let time=startMs;time<end;time+=1000/fps){
      if(Math.abs(video.currentTime-time/1000)>0.00001){const seeked=waitVideo('seeked');video.currentTime=time/1000;await seeked;}
      const bitmap=await createImageBitmap(video);
      const reply=await request({type:'frame',bitmap,timestampMs:time},[bitmap]);
      frames.push({timestampMs:Math.round(video.currentTime*1000),aspectRatio:video.videoWidth/video.videoHeight,landmarks:reply.landmarks.length===33?reply.landmarks:Array.from({length:33},()=>({x:0,y:0,z:0,visibility:0}))});
     }
     return frames;
    }finally{worker.terminate();video.removeAttribute('src');video.load();}
   },{index,startMs:clip.startMs,endMs:clip.endMs,fps});
   if(frames.length<2)throw new Error('Clip has fewer than two decoded samples');
   const {videoPath,...metadata}=clip;
   const encoded=JSON.stringify({...metadata,synthetic:fixture,normalization:{version:'mediapipe-browser-v1',sdk,modelSha256,fps,browser:browser.version(),timestamps:'video.currentTime after seek'},frames});
   outputBytes+=Buffer.byteLength(encoded,'utf8')+1;if(outputBytes>256*1024*1024)throw new Error('Output exceeds 256 MiB; split this extraction batch');records.push(encoded);
  }
  await mkdir(dirname(resolve(output)),{recursive:true});await writeFile(output,records.join('\n')+'\n',{flag:'wx'});
  console.log(`Normalized ${records.length} ${fixture?'synthetic fixture':'admitted public'} clips; camera validation remains pending`);
 }finally{await browser?.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
}
void main().catch(error=>{console.error('Normalization failed:',error.message);process.exitCode=1;});
