import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { getAppBaseUrl, getTrustedOrigins, validateServerEnv } from "@/lib/env";

const envState = validateServerEnv();

if (!envState.ok) {
  throw new Error(`Missing required server environment variables: ${envState.missing.join(", ")}`);
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verificationTokens,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production with email service
  },
  socialProviders: {
    // Add OAuth providers as needed
    // github: {
    //   clientId: process.env.GITHUB_CLIENT_ID!,
    //   clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    // },
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
