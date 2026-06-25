"use client";

import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { clearDemoSession } from "@/lib/dummy-auth";

function ClerkSignOut() {
  const clerk = useClerk();
  const router = useRouter();

  useEffect(() => {
    clearDemoSession();
    void clerk
      .signOut()
      .catch(() => undefined)
      .finally(() => {
        router.replace("/");
        router.refresh();
      });
  }, [clerk, router]);

  return (
    <div className="performance-shell flex min-h-screen items-center justify-center p-4">
      <p className="text-sm text-muted-foreground">Signing out...</p>
    </div>
  );
}

function LocalSignOut() {
  const router = useRouter();

  useEffect(() => {
    clearDemoSession();
    router.replace("/");
    router.refresh();
  }, [router]);

  return (
    <div className="performance-shell flex min-h-screen items-center justify-center p-4">
      <p className="text-sm text-muted-foreground">Signing out...</p>
    </div>
  );
}

export default function SignOutPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <LocalSignOut />;
  }

  return <ClerkSignOut />;
}
