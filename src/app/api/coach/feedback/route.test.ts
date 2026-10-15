import { beforeEach,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({profile:vi.fn(),feedback:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireServerSession:async()=>({user:{id:"verified-user"}})}));
vi.mock("@/lib/security/request-guard",()=>({guardMutationRequest:async()=>null,getRequestIp:()=>"local"}));
vi.mock("@/lib/server/app-data",()=>({getAppProfile:mocks.profile}));
vi.mock("@/lib/ai/coach",()=>({generateCoachFeedback:mocks.feedback}));
import { POST } from "./route";
beforeEach(()=>vi.resetAllMocks());
it("does not call AI without saved constraints when the profile service fails",async()=>{
 mocks.profile.mockRejectedValue(new Error("private database diagnostic"));
 const response=await POST(new Request("http://localhost/api/coach/feedback",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({exerciseType:"squat",repsSoFar:0})}));
 expect(response.status).toBe(500);expect(JSON.stringify(await response.json())).not.toContain("private database diagnostic");expect(mocks.feedback).not.toHaveBeenCalled();
});
