import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({clerkAuth:vi.fn(),currentUser:vi.fn(),legacy:vi.fn(),deleted:vi.fn(),mapping:vi.fn(),user:vi.fn(),transaction:vi.fn(),legacyEnabled:vi.fn()}));
vi.mock("@clerk/nextjs/server",()=>({auth:mocks.clerkAuth,currentUser:mocks.currentUser}));
vi.mock("next/headers",()=>({headers:async()=>new Headers()}));
vi.mock("@/db",()=>({isDatabaseConfigured:true,db:{query:{accountDeletionJobs:{findFirst:mocks.deleted},providerIdentities:{findFirst:mocks.mapping},users:{findFirst:mocks.user}},transaction:mocks.transaction}}));
vi.mock("@/lib/auth/config",()=>({auth:{api:{getSession:mocks.legacy}}}));
vi.mock("@/lib/env",()=>({assertProductionEnvironment:vi.fn(),isClerkAuthEnabled:()=>true,isDemoModeEnabled:()=>false,isLegacyAuthEnabled:mocks.legacyEnabled}));
import { getServerSession } from "./session";
const legacy={user:{id:"legacy-user",email:"existing@example.test",name:"Existing"},session:{userId:"legacy-user",expiresAt:new Date()}};
describe("verified identity resolution",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.legacyEnabled.mockReturnValue(true);mocks.clerkAuth.mockResolvedValue({userId:"clerk-subject",sessionId:"verified-session",sessionClaims:{exp:2000000000}});mocks.currentUser.mockResolvedValue({primaryEmailAddress:{emailAddress:"existing@example.test",verification:{status:"verified"}}});});
 it("uses the provider mapping even when emails differ",async()=>{
  mocks.mapping.mockResolvedValue({userId:"mapped-user"});mocks.user.mockResolvedValue({id:"mapped-user",email:"older@example.test",name:"Mapped"});
  expect((await getServerSession(new Headers()))?.user.id).toBe("mapped-user");expect(mocks.legacy).not.toHaveBeenCalled();expect(mocks.currentUser).not.toHaveBeenCalled();
 });
 it("lets a verified legacy owner reach explicit linking after a collision",async()=>{
  const { ApiError }=await import("@/lib/server/api");mocks.transaction.mockRejectedValue(new ApiError(409,"IDENTITY_LINK_REQUIRED","Link required"));mocks.legacy.mockResolvedValue(legacy);
  expect(await getServerSession(new Headers())).toBe(legacy);
 });
 it("preserves legacy access before explicit linking even after an email change",async()=>{
  mocks.legacy.mockResolvedValue(legacy);
  const headers=new Headers({cookie:"better-auth.session_token=verified-legacy-cookie"});
  expect(await getServerSession(headers)).toBe(legacy);
  expect(mocks.transaction).not.toHaveBeenCalled();expect(mocks.currentUser).not.toHaveBeenCalled();
 });
 it("never treats email collision alone as proof of ownership",async()=>{
  const { ApiError }=await import("@/lib/server/api");mocks.transaction.mockRejectedValue(new ApiError(409,"IDENTITY_LINK_REQUIRED","Link required"));mocks.legacy.mockResolvedValue(null);
  await expect(getServerSession(new Headers())).rejects.toMatchObject({code:"IDENTITY_LINK_REQUIRED"});
 });
 it("does not use legacy access when migration is disabled",async()=>{
  const { ApiError }=await import("@/lib/server/api");mocks.legacyEnabled.mockReturnValue(false);mocks.transaction.mockRejectedValue(new ApiError(409,"IDENTITY_LINK_REQUIRED","Link required"));
  await expect(getServerSession(new Headers())).rejects.toMatchObject({status:409});expect(mocks.legacy).not.toHaveBeenCalled();
 });
 it("denies tombstoned identities even with a valid legacy session",async()=>{
  mocks.deleted.mockResolvedValue({subject:"clerk-subject"});mocks.legacy.mockResolvedValue(legacy);
  await expect(getServerSession(new Headers())).rejects.toMatchObject({code:"ACCOUNT_DELETION_PENDING"});expect(mocks.legacy).not.toHaveBeenCalled();
 });
 it("propagates database failures instead of silently selecting another identity",async()=>{
  mocks.deleted.mockRejectedValue(new Error("Database unavailable"));mocks.legacy.mockResolvedValue(legacy);
  await expect(getServerSession(new Headers())).rejects.toThrow("Database unavailable");expect(mocks.legacy).not.toHaveBeenCalled();
 });
 it("requires verified email for admission",async()=>{
  mocks.currentUser.mockResolvedValue({primaryEmailAddress:{verification:{status:"unverified"}}});
  await expect(getServerSession(new Headers())).rejects.toMatchObject({code:"EMAIL_VERIFICATION_REQUIRED"});expect(mocks.transaction).not.toHaveBeenCalled();
 });
});
