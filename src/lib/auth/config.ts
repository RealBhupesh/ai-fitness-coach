import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, isDatabaseConfigured } from "@/db";
import * as schema from "@/db/schema";
import { describeServerEnvState, getAppBaseUrl, getTrustedOrigins, validateServerEnv } from "@/lib/env";

const envState = validateServerEnv();

if (!envState.ok) {
  throw new Error(`Server environment is not production-ready (${describeServerEnvState(envState)})`);
}

export const auth = betterAuth({
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
    enabled: true,
    requireEmailVerification: false, // Set to true in production with email service
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
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
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: getAppBaseUrl(),
  trustedOrigins: getTrustedOrigins(),
});

export type Session = typeof auth.$Infer.Session;
