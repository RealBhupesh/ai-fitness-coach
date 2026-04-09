import { describe, expect, it } from "vitest";
import { guardMutationRequest } from "@/lib/security/request-guard";

describe("request guard", () => {
  it("rejects requests from untrusted origins", async () => {
    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
      },
    });

    const response = guardMutationRequest(request, {
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
      guardMutationRequest(request, {
        bucket: "rate-limit-test",
        key: "user-1",
        limit: 1,
        windowMs: 60_000,
      }),
    ).toBeNull();

    const blocked = guardMutationRequest(request, {
      bucket: "rate-limit-test",
      key: "user-1",
      limit: 1,
      windowMs: 60_000,
    });

    expect(blocked?.status).toBe(429);
  });
});
