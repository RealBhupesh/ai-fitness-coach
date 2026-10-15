import { describe, expect, it } from "vitest";
import { apiError, readJson, pagination, ApiError } from "@/lib/server/api";
describe("API boundary",()=>{
 it("bounds streamed JSON without trusting content-length",async()=>{
  const request=new Request("https://example.com/api",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({value:"x".repeat(2000)})});
  await expect(readJson(request,1024)).rejects.toMatchObject({status:413});
 });
 it("returns actionable malformed JSON errors",async()=>{
  await expect(readJson(new Request("https://example.com",{method:"POST",headers:{"content-type":"application/json"},body:"{"}))).rejects.toMatchObject({status:400});
 });
 it("does not expose exception details",async()=>{
  const response=apiError(new Error("password=private; database host private.example"));
  const payload=await response.json();expect(response.status).toBe(500);expect(JSON.stringify(payload)).not.toContain("private");expect(payload.requestId).toBeTruthy();
  expect(apiError(new Error("UNAUTHORIZED")).status).toBe(401);
  expect(apiError(new ApiError(409,"SESSION_CONFLICT","Session conflict")).status).toBe(409);
 });
 it("rejects unlimited and fractional pagination",()=>{
  expect(()=>pagination(new Request("https://example.com?limit=101"))).toThrow();
  expect(()=>pagination(new Request("https://example.com?offset=0.5"))).toThrow();
 });
});
