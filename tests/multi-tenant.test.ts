// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, type TestDatabase } from "@/db/test-db";
import { users } from "@/db/schema";
import {
  assertCanAccessOrg,
  createOrganization,
  ensureUser,
  listMembershipsForUser,
  resolveAuthContext,
} from "@/db/queries";
import { OrgAccessError } from "@/auth/context";

type Fixtures = {
  db: TestDatabase;
  userA: { id: string; email: string };
  userB: { id: string; email: string };
  orgA: { id: string };
  orgB: { id: string };
};

async function seed(): Promise<Fixtures> {
  const db = await createTestDb();

  await ensureUser(db, { id: "user_A", email: "a@example.com" });
  await ensureUser(db, { id: "user_B", email: "b@example.com" });

  await createOrganization(db, {
    id: "org_A",
    name: "Acme",
    slug: "acme",
    ownerUserId: "user_A",
    membershipId: "m_A",
  });
  await createOrganization(db, {
    id: "org_B",
    name: "Beta",
    slug: "beta",
    ownerUserId: "user_B",
    membershipId: "m_B",
  });

  return {
    db,
    userA: { id: "user_A", email: "a@example.com" },
    userB: { id: "user_B", email: "b@example.com" },
    orgA: { id: "org_A" },
    orgB: { id: "org_B" },
  };
}

describe("multi-tenant isolation", () => {
  let f: Fixtures;
  beforeEach(async () => {
    f = await seed();
  });

  it("listMembershipsForUser only returns the caller's memberships", async () => {
    const aMemberships = await listMembershipsForUser(f.db, f.userA.id);
    expect(aMemberships).toHaveLength(1);
    expect(aMemberships[0].orgId).toBe(f.orgA.id);
    expect(aMemberships[0].role).toBe("owner");

    const bMemberships = await listMembershipsForUser(f.db, f.userB.id);
    expect(bMemberships).toHaveLength(1);
    expect(bMemberships[0].orgId).toBe(f.orgB.id);
  });

  it("assertCanAccessOrg rejects cross-org access", async () => {
    await expect(assertCanAccessOrg(f.db, f.userA.id, f.orgB.id)).rejects.toBeInstanceOf(
      OrgAccessError,
    );

    await expect(assertCanAccessOrg(f.db, f.userB.id, f.orgA.id)).rejects.toBeInstanceOf(
      OrgAccessError,
    );
  });

  it("assertCanAccessOrg succeeds for the caller's own org", async () => {
    await expect(assertCanAccessOrg(f.db, f.userA.id, f.orgA.id)).resolves.toBeUndefined();
  });

  it("resolveAuthContext refuses an org the caller doesn't belong to", async () => {
    await expect(resolveAuthContext(f.db, f.userA.id, f.orgB.id)).rejects.toBeInstanceOf(
      OrgAccessError,
    );
  });

  it("resolveAuthContext returns the user's first org when none is requested", async () => {
    const ctx = await resolveAuthContext(f.db, f.userA.id);
    expect(ctx).toEqual({ userId: "user_A", orgId: "org_A", role: "owner" });
  });

  it("resolveAuthContext throws for users with no memberships", async () => {
    await ensureUser(f.db, { id: "user_orphan", email: "orphan@example.com" });
    await expect(resolveAuthContext(f.db, "user_orphan")).rejects.toBeInstanceOf(OrgAccessError);
  });

  it("dual memberships work and resolveAuthContext honors the requested org", async () => {
    await f.db.insert(users).values({ id: "user_C", email: "c@example.com" });
    await createOrganization(f.db, {
      id: "org_C1",
      name: "C-One",
      slug: "c-one",
      ownerUserId: "user_C",
      membershipId: "m_C1",
    });
    await createOrganization(f.db, {
      id: "org_C2",
      name: "C-Two",
      slug: "c-two",
      ownerUserId: "user_C",
      membershipId: "m_C2",
    });

    const ctx1 = await resolveAuthContext(f.db, "user_C", "org_C1");
    expect(ctx1.orgId).toBe("org_C1");
    const ctx2 = await resolveAuthContext(f.db, "user_C", "org_C2");
    expect(ctx2.orgId).toBe("org_C2");
  });
});
