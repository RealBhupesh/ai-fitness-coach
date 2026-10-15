import { afterEach,expect,it,vi } from "vitest";
afterEach(async()=>{
 await globalThis.__fitcoachPool?.end();globalThis.__fitcoachPool=undefined;
 vi.restoreAllMocks();vi.unstubAllEnvs();vi.resetModules();
});
it("keeps a missing database unavailable",async()=>{
 vi.stubEnv("DATABASE_URL","");const database=await import("./index");
 expect(database.isDatabaseConfigured).toBe(false);expect(()=>database.db.select()).toThrow("DATABASE_UNAVAILABLE");
});
it("does not expose credentials when a database URL is malformed",async()=>{
 vi.stubEnv("DATABASE_URL","postgres://user:test-secret@[");
 try {await import("./index");throw new Error("Expected configuration rejection");}
 catch(error){expect((error as Error).message).toBe("DATABASE_URL_INVALID");expect(String(error)).not.toContain("test-secret");}
});
it("handles idle pool errors with a redacted event",async()=>{
 vi.stubEnv("DATABASE_URL","postgres://test:test@localhost:5432/isolated_test");const log=vi.spyOn(console,"info").mockImplementation(()=>{});
 const {dbPool}=await import("./index");dbPool!.emit("error",new Error("private database diagnostic"));
 expect(log).toHaveBeenCalledOnce();expect(String(log.mock.calls[0][0])).toContain("database_pool_error");expect(String(log.mock.calls[0][0])).not.toContain("private database diagnostic");
});
