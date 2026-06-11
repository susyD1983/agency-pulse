import { and, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { memberships, organizations, users } from "./schema";
import type { Membership, MembershipRole, NewOrganization, NewUser } from "./schema";
import { OrgAccessError, type AuthContext } from "@/auth/context";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = PgDatabase<any, any, any>;

export async function listMembershipsForUser(db: AnyDb, userId: string): Promise<Membership[]> {
  return db.select().from(memberships).where(eq(memberships.userId, userId));
}

export async function getMembership(
  db: AnyDb,
  userId: string,
  orgId: string,
): Promise<Membership | null> {
  const rows = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Build the {@link AuthContext} for a request.
 *
 * Verifies the user belongs to the org they're acting in. If `orgId` is
 * omitted, picks the user's first membership (deterministic by creation
 * order); the caller can switch orgs later. Throws {@link OrgAccessError}
 * if the user has no membership in the requested org.
 */
export async function resolveAuthContext(
  db: AnyDb,
  userId: string,
  orgId?: string,
): Promise<AuthContext> {
  if (orgId) {
    const m = await getMembership(db, userId, orgId);
    if (!m) {
      throw new OrgAccessError(`User ${userId} has no membership in org ${orgId}`);
    }
    return { userId, orgId, role: m.role };
  }
  const all = await listMembershipsForUser(db, userId);
  if (all.length === 0) {
    throw new OrgAccessError(`User ${userId} has no memberships`);
  }
  const first = all[0];
  return { userId, orgId: first.orgId, role: first.role };
}

export async function assertCanAccessOrg(db: AnyDb, userId: string, orgId: string): Promise<void> {
  const m = await getMembership(db, userId, orgId);
  if (!m) {
    throw new OrgAccessError(`User ${userId} has no membership in org ${orgId}`);
  }
}

export type CreateOrgInput = {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  membershipId: string;
};

/**
 * Create an organization and grant the creating user the `owner` role.
 * The user row must already exist (created during sign-up).
 */
export async function createOrganization(
  db: AnyDb,
  input: CreateOrgInput,
): Promise<{ org: NewOrganization; membership: Membership }> {
  return await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({ id: input.id, name: input.name, slug: input.slug })
      .returning();
    const [m] = await tx
      .insert(memberships)
      .values({
        id: input.membershipId,
        orgId: input.id,
        userId: input.ownerUserId,
        role: "owner" satisfies MembershipRole,
      })
      .returning();
    return { org, membership: m };
  });
}

export async function ensureUser(db: AnyDb, input: NewUser): Promise<NewUser> {
  const [u] = await db
    .insert(users)
    .values(input)
    .onConflictDoNothing({ target: users.id })
    .returning();
  if (u) return u;
  const existing = await db.select().from(users).where(eq(users.id, input.id)).limit(1);
  return existing[0]!;
}
