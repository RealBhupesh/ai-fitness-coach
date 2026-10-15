import { afterEach, describe, expect, it, vi } from "vitest";
import { guardMutationRequest } from "@/lib/security/request-guard";

describe("request guard", () => {
  it("rejects requests from untrusted origins", async () => {
    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
      },
    });

    const response = await guardMutationRequest(request, {
      bucket: "origin-test",
      key: "user-1",
      limit: 5,
      windowMs: 60_000,
    });

    expect(response?.status).toBe(403);
  });

  it("rate limits repeated requests in the same bucket", async () => {
    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
      },
    });

    expect(
      await guardMutationRequest(request, {
        bucket: "rate-limit-test",
        key: "user-1",
        limit: 1,
        windowMs: 60_000,
      }),
    ).toBeNull();

    const blocked = await guardMutationRequest(request, {
      bucket: "rate-limit-test",
      key: "user-1",
      limit: 1,
      windowMs: 60_000,
    });

    expect(blocked?.status).toBe(429);
  });
});

afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("shared production quotas",()=>{
 it("fails closed when Redis cannot verify limits",async()=>{
  vi.stubEnv("NODE_ENV","production");vi.stubEnv("UPSTASH_REDIS_REST_URL","https://redis.example");vi.stubEnv("UPSTASH_REDIS_REST_TOKEN","test-only");vi.stubGlobal("fetch",vi.fn(async()=>{throw new Error("network");}));
  const result=await guardMutationRequest(new Request("http://localhost:3000/api/chat",{method:"POST",headers:{origin:"http://localhost:3000"}}),{bucket:"chat",key:"user",limit:24,windowMs:60000});expect(result?.status).toBe(503);
 });
 it("uses a daily user quota separately from burst limits",async()=>{
  vi.stubEnv("NODE_ENV","production");vi.stubEnv("UPSTASH_REDIS_REST_URL","https://redis.example");vi.stubEnv("UPSTASH_REDIS_REST_TOKEN","test-only");
  const fetch=vi.fn().mockResolvedValueOnce(Response.json({result:[1,60000]})).mockResolvedValueOnce(Response.json({result:[21,50000]}));vi.stubGlobal("fetch",fetch);
  const result=await guardMutationRequest(new Request("http://localhost:3000/api/chat",{method:"POST",headers:{origin:"http://localhost:3000"}}),{bucket:"chat",key:"user",limit:24,windowMs:60000});expect(result?.status).toBe(429);expect(fetch).toHaveBeenCalledTimes(2);
 });
});
