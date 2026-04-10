import { useEffect, useState } from "react";
import { createAuthClient } from "better-auth/react";
import { getDemoSession, buildDemoServerSession } from "@/lib/dummy-auth";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});

export const { signIn, signUp, signOut } = authClient;

export function useSession() {
  const real = authClient.useSession();
  const [demoData, setDemoData] = useState<ReturnType<typeof buildDemoServerSession> | null | undefined>(undefined);

  useEffect(() => {
    if (!real.isPending) {
      if (real.data?.user?.id) {
        setDemoData(null);
      } else {
        const demo = getDemoSession();
        setDemoData(demo ? buildDemoServerSession() : null);
      }
    }
  }, [real.isPending, real.data?.user?.id]);

  if (real.isPending || demoData === undefined) {
    return { ...real, isPending: true as const };
  }

  if (demoData) {
    return { ...real, data: demoData as any, isPending: false as const };
  }

  return real;
}
