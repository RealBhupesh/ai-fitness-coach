"use client";
import { createContext,useContext,useEffect,useState,type ReactNode } from "react";
import { usePathname } from "next/navigation";
type SessionData={session:{userId:string;expiresAt:string|null}|null;user:{id:string;email?:string|null;name?:string|null;image?:string|null}|null};
const context=createContext<{data:SessionData|null;isPending:boolean;error:Error|null}>({data:null,isPending:true,error:null});
export function useAppSession(){return useContext(context);}
export function AppSessionProvider({children}:{children:ReactNode}){
 const path=usePathname();const [data,setData]=useState<SessionData|null>(null);const [pending,setPending]=useState(true);const [error,setError]=useState<Error|null>(null);const [profileError,setProfileError]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();setPending(true);setError(null);
  fetch("/api/session",{credentials:"include",cache:"no-store",signal:controller.signal}).then(async response=>{
   if(response.status===401)return null;const payload=await response.json();if(!response.ok)throw new Error(payload.error||"Session unavailable");return payload as SessionData;
  }).then(result=>{if(!controller.signal.aborted)setData(result);}).catch(reason=>{if(!controller.signal.aborted){setData(null);setError(reason);}}).finally(()=>{if(!controller.signal.aborted)setPending(false);});
  return()=>controller.abort();
 },[path]);
 useEffect(()=>{
  if(!data?.user?.id)return;
  const controller=new AbortController();
  void fetch("/api/settings",{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error();return r.json();}).then(({settings})=>{if(!controller.signal.aborted)document.documentElement.classList.toggle("dark",settings.theme==="dark"||(settings.theme==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches));}).catch(()=>{});
  return()=>controller.abort();
 },[data?.user?.id]);
 useEffect(()=>{const failure=()=>setProfileError(true);const recovery=()=>setProfileError(false);window.addEventListener("fitcoach:profile-error",failure);window.addEventListener("fitcoach:profile-ready",recovery);return()=>{window.removeEventListener("fitcoach:profile-error",failure);window.removeEventListener("fitcoach:profile-ready",recovery);};},[]);
 return <context.Provider value={{data,isPending:pending,error}}>{(error||profileError)&&<div role="alert" className="relative z-50 flex flex-wrap items-center justify-center gap-3 bg-amber-500/15 px-4 py-3 text-sm text-amber-200"><span>{error?.message||"Your saved profile could not be loaded. Retry before editing or starting a workout."}</span><button className="font-semibold underline" onClick={()=>window.location.reload()}>Retry</button></div>}{children}</context.Provider>;
}
