import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";
import { applySchema } from "./migrate";

export type TestDatabase = ReturnType<typeof drizzle<typeof schema>>;

export async function createTestDb(): Promise<TestDatabase> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await applySchema(db);
  return db;
}
