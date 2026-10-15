import { reportEvent } from "@/lib/server/observability";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var __fitcoachPool: Pool | undefined;
}

function shouldUseSsl(connectionString: string) {
  let hostname: string;
  try { hostname = new URL(connectionString).hostname; }
  catch { throw new Error("DATABASE_URL_INVALID"); }
  return !["localhost", "127.0.0.1", "[::1]"].includes(hostname) && !(process.env.NODE_ENV !== "production" && process.env.DATABASE_SSL === "false");
}

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL?.trim());

function createUnavailableDatabase() {
  return new Proxy(
    {},
    {
      get() {
        throw new Error("DATABASE_UNAVAILABLE");
      },
    },
  ) as ReturnType<typeof drizzle<typeof schema>>;
}

const databaseUrl = process.env.DATABASE_URL?.trim();
const connectionString = databaseUrl ? (() => {
  let url: URL;
  try { url = new URL(databaseUrl); }
  catch { throw new Error("DATABASE_URL_INVALID"); }
  // pg's connection-string sslmode must not override certificate verification.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"]) url.searchParams.delete(key);
  return url.toString();
})() : undefined;

const pool = connectionString
  ? globalThis.__fitcoachPool ??
    new Pool({
      connectionString,
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: true, ca: process.env.DATABASE_SSL_CA?.replace(/\\n/g, "\n") } : undefined,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      statement_timeout: 10000,
    })
  : null;

if (pool && process.env.NODE_ENV !== "production") {
  globalThis.__fitcoachPool = pool;
}

if (pool && pool.listenerCount("error") === 0) {
  pool.on("error", () => reportEvent("database_pool_error", { code: "DATABASE_CONNECTION_ERROR" }));
}

export const db = pool ? drizzle(pool, { schema }) : createUnavailableDatabase();
export const dbPool = pool;

export * from "./schema";
