import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCameraController } from "./controller";
describe("camera lifecycle",()=>{
 const track={stop:vi.fn(),addEventListener:vi.fn(),getSettings:()=>({}),applyConstraints:vi.fn()};
 const stream={getTracks:()=>[track],getVideoTracks:()=>[track]} as unknown as MediaStream;
 let video:HTMLVideoElement;
 let animationCallback: (now: number) => Promise<void>;
 let callback:(now:number,metadata:unknown)=>Promise<void>;
 beforeEach(()=>{
  vi.clearAllMocks();
  vi.stubGlobal("document",{hidden:false,addEventListener:vi.fn(),removeEventListener:vi.fn()});
  vi.stubGlobal("window",{addEventListener:vi.fn(),removeEventListener:vi.fn(),cancelAnimationFrame:vi.fn(),requestAnimationFrame:vi.fn(fn=>{animationCallback=fn;return 2;})});
  vi.stubGlobal("navigator",{mediaDevices:{getUserMedia:vi.fn().mockResolvedValue(stream)}});
  video={srcObject:null,play:vi.fn().mockResolvedValue(undefined),requestVideoFrameCallback:vi.fn(fn=>{callback=fn;return 1;}),cancelVideoFrameCallback:vi.fn(),currentTime:0,videoWidth:640,videoHeight:360} as unknown as HTMLVideoElement;
 });
 afterEach(()=>vi.unstubAllGlobals());
 it("releases permission results arriving after stop",async()=>{
  let release!:(stream:MediaStream)=>void;
  vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise(resolve=>{release=resolve;}));
  const controller=createCameraController({video,onFrame:vi.fn()});
  const starting=controller.start();controller.stop();release(stream);
  await expect(starting).rejects.toThrow("cancelled");
  expect(track.stop).toHaveBeenCalledOnce();expect(controller.isRunning()).toBe(false);expect(video.srcObject).toBeNull();
 });
 it("waits for analysis before scheduling another frame",async()=>{
  let finish!:()=>void;const analyze=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
  const controller=createCameraController({video,onFrame:analyze});await controller.start();
  const frame=callback(0,{});expect(analyze).toHaveBeenCalledOnce();expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(1);
  finish();await frame;expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(2);controller.stop();
 });
 it("does not score a queued callback after stop",async()=>{
  const analyze=vi.fn();const controller=createCameraController({video,onFrame:analyze});await controller.start();
  const queued=callback;controller.stop();await queued(0,{});expect(analyze).not.toHaveBeenCalled();
 });
 it("keeps a minimized stream alive and scores only new decoded frames",async()=>{
  const analyze=vi.fn();const reset=vi.fn();const controller=createCameraController({video,onFrame:analyze,onReset:reset});
  await controller.start();controller.setPreviewVisible(false);
  expect(video.cancelVideoFrameCallback).toHaveBeenCalled();
  await animationCallback(100);expect(analyze).not.toHaveBeenCalled();
  video.currentTime=0.1;await animationCallback(200);expect(analyze).toHaveBeenCalledOnce();
  await animationCallback(300);expect(analyze).toHaveBeenCalledOnce();
  await animationCallback(1300);expect(reset).toHaveBeenCalledOnce();
  await animationCallback(1400);expect(reset).toHaveBeenCalledOnce();
  video.currentTime=0.2;await animationCallback(1500);expect(analyze).toHaveBeenCalledTimes(2);
  controller.setPreviewVisible(true);expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(2);
  expect(track.stop).not.toHaveBeenCalled();controller.stop();expect(track.stop).toHaveBeenCalledOnce();
 });
 it("does not overlap analysis when preview mode changes during inference",async()=>{
  let finish!:()=>void;const analyze=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
  const controller=createCameraController({video,onFrame:analyze});await controller.start();
  const original=callback(0,{});controller.setPreviewVisible(false);video.currentTime=0.1;
  await animationCallback(200);expect(analyze).toHaveBeenCalledOnce();
  finish();await original;controller.stop();
 });

});
