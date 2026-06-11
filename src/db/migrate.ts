import type { PgDatabase } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_unique ON organizations (slug)`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    auth_provider_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_auth_provider_unique ON users (auth_provider_id)`,
  `CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS memberships_org_user_unique ON memberships (org_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships (user_id)`,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applySchema(db: PgDatabase<any, any, any>): Promise<void> {
  for (const stmt of STATEMENTS) {
    await db.execute(sql.raw(stmt));
  }
}
