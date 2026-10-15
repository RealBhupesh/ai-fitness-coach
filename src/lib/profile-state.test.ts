import { expect,it } from "vitest";
import { isProfileReadyForEdit } from "./profile-state";
it("rejects unloaded, failed and mismatched profile edits",()=>{
 expect(isProfileReadyForEdit("user",null,false,null)).toBe(false);
 expect(isProfileReadyForEdit("user",{userId:"user"},true,null)).toBe(false);
 expect(isProfileReadyForEdit("user",{userId:"user"},false,"Profile unavailable")).toBe(false);
 expect(isProfileReadyForEdit("user",{userId:"other"},false,null)).toBe(false);
 expect(isProfileReadyForEdit(undefined,{userId:"user"},false,null)).toBe(false);
});
it("permits edits after the same user's profile loads",()=>expect(isProfileReadyForEdit("user",{userId:"user"},false,null)).toBe(true));
