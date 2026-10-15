import { expect,test } from "@playwright/test";
import { mkdtemp,readFile,writeFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve,sep } from "node:path";
import { spawn } from "node:child_process";
test("offline extraction preserves timestamps and synthetic provenance",async({browser})=>{
 test.setTimeout(120000);
 const directory=await mkdtemp(join(tmpdir(),"fitcoach-normalization-"));
 try {
  const context=await browser.newContext({viewport:{width:192,height:192},recordVideo:{dir:directory,size:{width:192,height:192}}});
  const page=await context.newPage();await page.goto('data:text/html,<body style="background:%23999"></body>');
  await page.waitForTimeout(1200);const video=page.video()!;await context.close();const videoPath=await video.path();
  const manifest={synthetic:true,labelProtocol:"Decoder fixture, not form-training evidence",subjects:["fixture-subject"],exerciseVariants:{squat:["fixture"]},labelDefinitions:{},sources:[{id:"fixture",type:"synthetic_fixture",url:"https://example.test/fixture",license:"Test fixture only",permittedUses:["research"]}],recordings:[{sourceId:"fixture",videoId:"fixture-video",subjectIds:["fixture-subject"],exerciseVariants:{squat:["fixture"]}}]};
  const clips=[{sourceId:"fixture",videoId:"fixture-video",subjectId:"fixture-subject",exerciseId:"squat",exerciseVariant:"fixture",faults:[],videoPath,startMs:0,endMs:900}];
  const input=join(directory,"clips.json"),source=join(directory,"manifest.json"),output=join(directory,"landmarks.jsonl");
  await Promise.all([writeFile(input,JSON.stringify(clips)),writeFile(source,JSON.stringify(manifest))]);
  const result=await new Promise<{code:number|null;log:string}>((ok,fail)=>{
   const child=spawn(process.execPath,[resolve("scripts/extract-posture-landmarks.mjs"),"--input",input,"--manifest",source,"--output",output,"--fps","2","--fixture"],{cwd:process.cwd(),windowsHide:true});
   const timer=setTimeout(()=>{child.kill();fail(new Error("Normalization fixture exceeded its deadline"));},90000);
   let log="";child.stdout.on("data",data=>{log+=data;});child.stderr.on("data",data=>{log+=data;});child.once("error",fail);child.once("close",code=>{clearTimeout(timer);ok({code,log});});
  });
  expect(result.code,result.log).toBe(0);
  const row=JSON.parse((await readFile(output,"utf8")).trim());
  expect(row.synthetic).toBe(true);expect(row.frames[0].aspectRatio).toBeGreaterThan(0);expect(row.videoId).toBe("fixture-video");expect(row.frames.length).toBeGreaterThanOrEqual(2);expect(row.frames[0].landmarks).toHaveLength(33);expect(row.frames[1].timestampMs).toBeGreaterThan(row.frames[0].timestampMs);expect(row.normalization.modelSha256).toMatch(/^[a-f0-9]{64}$/);expect(row).not.toHaveProperty("videoPath");
 } finally {
  const root=resolve(tmpdir());const target=resolve(directory);if(!target.startsWith(root+sep))throw new Error("Unsafe fixture cleanup path");
  await rm(target,{recursive:true,force:true});
 }
});
