"use client";

import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { Card, CardContent } from "@/components/ui/card";

export default function ClerkSignUpPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="performance-shell flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="space-y-3 pt-6">
            <h1 className="text-2xl font-black uppercase">Clerk is not configured</h1>
            <p className="text-sm text-muted-foreground">Add Clerk keys to `.env.local`, or use the existing account creation flow.</p>
            <Link href="/signup" className="text-primary">Go to signup</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="performance-shell flex min-h-screen items-center justify-center p-4">
      <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/onboarding" />
    </div>
  );
}
