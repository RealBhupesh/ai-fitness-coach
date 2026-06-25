import { useEffect, useState } from "react";
import { createAuthClient } from "better-auth/react";
import { getDemoSession, buildDemoServerSession } from "@/lib/dummy-auth";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});

export const { signIn, signUp, signOut } = authClient;

type ServerSessionData = {
  session: { userId: string; expiresAt: string | null } | null;
  user: { id: string; email?: string | null; name?: string | null; image?: string | null } | null;
};

export function useSession() {
  const real = authClient.useSession();
  const [demoData, setDemoData] = useState<ReturnType<typeof buildDemoServerSession> | null | undefined>(undefined);
  const [serverData, setServerData] = useState<ServerSessionData | null | undefined>(undefined);

  useEffect(() => {
    if (!real.isPending) {
      if (real.data?.user?.id) {
        setDemoData(null);
        setServerData(null);
      } else {
        const demo = getDemoSession();
        setDemoData(demo ? buildDemoServerSession() : null);
        if (!demo) {
          fetch("/api/session", { credentials: "include" })
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => setServerData(data))
            .catch(() => setServerData(null));
        } else {
          setServerData(null);
        }
      }
    }
  }, [real.isPending, real.data?.user?.id]);

  if (real.isPending || demoData === undefined || serverData === undefined) {
    return { ...real, isPending: true as const };
  }

  if (demoData) {
    return { ...real, data: demoData as any, isPending: false as const };
  }

  if (serverData?.user?.id) {
    return {
      ...real,
      data: {
        session: serverData.session,
        user: serverData.user,
      } as any,
      isPending: false as const,
    };
  }

  return real;
}
