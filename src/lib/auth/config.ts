import { reportEvent } from "@/lib/server/observability";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, isDatabaseConfigured } from "@/db";
import * as schema from "@/db/schema";
import { getAppBaseUrl, getTrustedOrigins, isLegacyAuthEnabled } from "@/lib/env";

const DEMO_AUTH_SECRET = "fitcoach-demo-only-fallback-secret-for-vercel-preview";

export const auth = betterAuth({
  // Provider errors can include SQL parameters and personal account data.
  logger: { level: "warn", log: () => reportEvent("auth_warning", { code: "AUTH_PROVIDER_EVENT" }) },
  onAPIError: { onError: () => reportEvent("auth_request_failed", { code: "AUTH_REQUEST_FAILED" }) },
  ...(isDatabaseConfigured
    ? {
        database: drizzleAdapter(db, {
          provider: "pg",
          schema: {
            user: schema.users,
            session: schema.sessions,
            account: schema.accounts,
            verification: schema.verificationTokens,
          },
        }),
      }
    : {}),
  emailAndPassword: {
    enabled: isLegacyAuthEnabled(),
    disableSignUp: process.env.NODE_ENV === "production",
    requireEmailVerification: false, // Set to true in production with email service
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            disableSignUp: process.env.NODE_ENV === "production",
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  account: { accountLinking: { enabled: false } },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  advanced: {
    database: {
      generateId: () => {
        const { nanoid } = require("nanoid");
        return nanoid();
      },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET || DEMO_AUTH_SECRET,
  baseURL: getAppBaseUrl(),
  trustedOrigins: getTrustedOrigins(),
});

export type Session = typeof auth.$Infer.Session;
