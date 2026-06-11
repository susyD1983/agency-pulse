import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let cached: Database | null = null;

export function getDb(): Database {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Provision a Neon (or other Postgres) database " +
        "and add the connection string to the environment.",
    );
  }
  const sql = postgres(url, { prepare: false });
  cached = drizzle(sql, { schema });
  return cached;
}
