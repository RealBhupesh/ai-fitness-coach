import { AppSessionProvider } from "@/components/auth/AppSessionProvider";
import { ClerkProvider } from "@clerk/nextjs";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return <AppSessionProvider>{children}</AppSessionProvider>;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <AppSessionProvider>{children}</AppSessionProvider>
    </ClerkProvider>
  );
}
