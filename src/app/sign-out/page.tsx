"use client";
import { useEffect,useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { clearDemoSession } from "@/lib/dummy-auth";
import { authClient } from "@/lib/auth/client";
async function clearLegacySession(){
 const result=await authClient.signOut();
 if(result.error && result.error.status!==404)throw new Error("Sign-out could not complete. Please retry.");
}
function Status({error}:{error:string|null}){
 return <div className="performance-shell flex min-h-screen items-center justify-center p-4"><div role="status"><p>{error||"Signing out..."}</p>{error&&<button className="mt-4 underline" onClick={()=>window.location.reload()}>Retry sign-out</button>}</div></div>;
}
function ClerkSignOut(){
 const clerk=useClerk();const router=useRouter();const [error,setError]=useState<string|null>(null);
 useEffect(()=>{
  clearDemoSession();
  void Promise.all([clearLegacySession(),clerk.signOut()]).then(()=>{router.replace("/");router.refresh();}).catch(()=>setError("Sign-out could not complete. Please retry."));
 },[clerk,router]);
 return <Status error={error}/>;
}
function LocalSignOut(){
 const router=useRouter();const [error,setError]=useState<string|null>(null);
 useEffect(()=>{
  clearDemoSession();void clearLegacySession().then(()=>{router.replace("/");router.refresh();}).catch(()=>setError("Sign-out could not complete. Please retry."));
 },[router]);
 return <Status error={error}/>;
}
export default function SignOutPage(){return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?<ClerkSignOut/>:<LocalSignOut/>;}
