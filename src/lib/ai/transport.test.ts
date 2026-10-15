import { describe, expect, it, vi } from "vitest";
import { completionWithFailover, type CompletionAttempt } from "@/lib/ai/transport";
import type { ChatCompletion } from "openai/resources/chat/completions";
const completion={id:"test",object:"chat.completion",created:0,model:"fallback-model",choices:[{index:0,message:{role:"assistant",content:"Valid grounded answer",refusal:null},finish_reason:"stop",logprobs:null}]} satisfies ChatCompletion;
const params={model:"primary",messages:[{role:"user" as const,content:"Explain recorded evidence"}]};
describe("provider failover",()=>{
 it("tries OpenAI after Groq fails and records the actual provider",async()=>{
  const second=vi.fn(async()=>completion);const candidates:CompletionAttempt[]=[{provider:"groq",model:"first",create:async()=>{throw new Error("outage");}},{provider:"openai",model:"second",create:second}];
  const result=await completionWithFailover(params,candidates,{quota:false});expect(result.provider).toBe("openai");expect(second).toHaveBeenCalledTimes(1);
 });
 it("fails over malformed output instead of accepting it",async()=>{
  const result=await completionWithFailover(params,[{provider:"groq",model:"first",create:async()=>({...completion,choices:[{...completion.choices[0],message:{...completion.choices[0].message,content:"{}"}}]})},{provider:"openai",model:"second",create:async()=>completion}],{quota:false,validate:output=>{if(output.choices[0].message.content==="{}")throw new Error("invalid plan");}});
  expect(result.provider).toBe("openai");
 });
 it("bounds output tokens, candidate count and individual messages",async()=>{
  const create=vi.fn<CompletionAttempt["create"]>(async()=>completion);
  await completionWithFailover({...params,max_tokens:20000,n:4,messages:[{role:"user",content:"x".repeat(20000)}]},[{provider:"groq",model:"first",create}],{quota:false});
  const sent=create.mock.calls[0][0];expect(sent.max_tokens).toBe(1600);expect(sent.n).toBe(1);expect(sent.messages[0].content).toHaveLength(12000);
 });
 it("does not call any provider after user cancellation",async()=>{
  const controller=new AbortController();controller.abort();const create=vi.fn(async()=>completion);
  await expect(completionWithFailover(params,[{provider:"groq",model:"first",create}],{quota:false,signal:controller.signal})).rejects.toThrow();expect(create).not.toHaveBeenCalled();
 });
});
