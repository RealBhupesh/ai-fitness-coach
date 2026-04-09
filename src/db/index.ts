import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var __fitcoachPool: Pool | undefined;
}

function shouldUseSsl(connectionString: string) {
  return !/localhost|127\.0\.0\.1/i.test(connectionString);
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required. Configure a PostgreSQL connection before starting the app.");
}

const pool =
  globalThis.__fitcoachPool ??
  new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__fitcoachPool = pool;
}

export const db = drizzle(pool, { schema });
export const dbPool = pool;

export * from "./schema";
