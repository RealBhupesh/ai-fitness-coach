import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var __fitcoachPool: Pool | undefined;
}

function shouldUseSsl(connectionString: string) {
  return !/localhost|127\.0\.0\.1/i.test(connectionString);
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

const connectionString = process.env.DATABASE_URL?.trim();

const pool = connectionString
  ? globalThis.__fitcoachPool ??
    new Pool({
      connectionString,
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
      max: 10,
    })
  : null;

if (pool && process.env.NODE_ENV !== "production") {
  globalThis.__fitcoachPool = pool;
}

export const db = pool ? drizzle(pool, { schema }) : createUnavailableDatabase();
export const dbPool = pool;

export * from "./schema";
