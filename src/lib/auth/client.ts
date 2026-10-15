"use client";
import { useEffect, useState } from "react";
import { createAuthClient } from "better-auth/react";
import { getDemoSession, buildDemoServerSession } from "@/lib/dummy-auth";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});

export const { signIn, signUp } = authClient;
export async function signOut() {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    window.location.assign("/sign-out");
    return;
  }
  await authClient.signOut();
}

export { useAppSession as useSession } from "@/components/auth/AppSessionProvider";
