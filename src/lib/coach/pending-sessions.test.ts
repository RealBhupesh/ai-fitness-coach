import { describe, expect, it, vi } from "vitest";
import { enqueueSession, readPending, removePending, clearUserDeviceData } from "@/lib/coach/pending-sessions";
describe("session recovery",()=>{
 it("preserves the original snapshot across retries and isolates users",()=>{
  const values=new Map<string,string>();const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
  enqueueSession(storage,"user-a",{clientSessionId:"session-1",totalReps:10});
  const retry=enqueueSession(storage,"user-a",{clientSessionId:"session-1",totalReps:11});
  expect(retry.payload.totalReps).toBe(10);expect(readPending(storage,"user-b")).toEqual([]);
  removePending(storage,"user-a","session-1");expect(readPending(storage,"user-a")).toEqual([]);
 });
});

it("deletion clears only the selected user's pending sessions and curl memory", () => {
 const removeItem=vi.fn();clearUserDeviceData({removeItem},"selected-user");
 expect(removeItem.mock.calls).toEqual([["fitcoach:pending-sessions:selected-user"],["fitness-coach:last-curl-memory:selected-user"]]);
});
