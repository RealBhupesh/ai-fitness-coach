"use client";

import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { Card, CardContent } from "@/components/ui/card";

export default function ClerkSignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="performance-shell flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="space-y-3 pt-6">
            <h1 className="text-2xl font-black uppercase">Clerk is not configured</h1>
            <p className="text-sm text-muted-foreground">Add Clerk keys to `.env.local`, or use the existing email/password login.</p>
            <Link href="/login" className="text-primary">Go to login</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="performance-shell flex min-h-screen items-center justify-center p-4">
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
