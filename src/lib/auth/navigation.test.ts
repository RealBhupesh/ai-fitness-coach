import { describe,expect,it } from "vitest";
import { safeNextPath } from "./navigation";
describe("return-to navigation",()=>{
 it.each([null,"","//external.test","https://external.test","javascript:alert(1)","/\\external.test","/%2fexternal.test","/\n/external.test"])("rejects unsafe target %s",target=>expect(safeNextPath(target)).toBe("/dashboard"));
 it("preserves local paths, queries and anchors",()=>expect(safeNextPath("/review-lab?tab=history#session")).toBe("/review-lab?tab=history#session"));
});
