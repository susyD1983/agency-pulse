# ADR 0002 — Auth provider and multi-tenant data model

Status: Accepted
Date: 2026-06-10
Driving issue: [GEM-5](/GEM/issues/GEM-5) — Auth + multi-tenant data model (Org/User/Membership)
Predecessor: [ADR 0001](./0001-stack.md) picked Clerk + Postgres/Drizzle/Neon

## Context

Agency Pulse is a B2B tool. Every user belongs to one or more **Organizations**
(an agency), and every piece of data the product stores belongs to exactly one
org. Cross-org leakage is the worst-case data bug — it would end customer trust
overnight. The model has to be correct from day one; this is the one-way door
the CEO flagged on GEM-5.

The companion concern is the auth provider. ADR 0001 chose **Clerk**, but the
provider keys and Vercel hosting are not yet provisioned. We need a code shape
that lets the rest of the product be written now and Clerk dropped in once the
CEO completes the account setup.

## Decisions

### Data model

Three tables, all keyed by text ids (Clerk-style identifiers):

- `organizations(id, name, slug, created_at)` — one row per agency.
- `users(id, email, auth_provider_id, created_at)` — one row per identity.
  `id` matches the Clerk user id (`user_…`). `auth_provider_id` is reserved
  for cases where we need to look users up by an external id different from
  ours.
- `memberships(id, org_id, user_id, role, created_at)` — links users into
  orgs. `role` is `'owner' | 'member'`. Unique on `(org_id, user_id)`.

Foreign keys cascade on delete so a fully terminated tenancy cleans itself up.

Roles are intentionally minimal. A full RBAC system can layer on top later
without a migration; we just split `owner` into finer-grained capabilities.

### Auth boundary

All identity reads go through `src/auth/context.ts`:

```ts
export type AuthContext = { userId: string; orgId: string; role: MembershipRole };
export async function getAuthContext(): Promise<AuthContext | null>;
export async function requireAuthContext(): Promise<AuthContext>;
```

Route handlers, server actions, and server components never read auth cookies
or call Clerk directly — they only call this module. Clerk wiring becomes a
single-file change in a follow-up (GEM-7).

### Server-side scoping

Every data read or write that touches tenant data takes an `AuthContext` (or
a `{ userId, orgId }` pair derived from it) and joins / filters by `orgId`.
The helpers in `src/db/queries.ts` are the canonical primitives:

- `resolveAuthContext(db, userId, orgId?)` — verifies membership before
  returning a context. Refuses cross-org access with `OrgAccessError`.
- `assertCanAccessOrg(db, userId, orgId)` — same check, callable from any
  layer that already has an `orgId`.
- `createOrganization(db, …)` — creates org + grants `owner` membership in a
  single transaction.

A user-facing route MUST do this in order:

1. `requireAuthContext()` — get the current identity from Clerk.
2. If the route accepts an `orgId` parameter (path/header/query), pass it to
   `resolveAuthContext(db, userId, orgId)`. The helper refuses non-members.
3. Use the returned `AuthContext.orgId` for every subsequent query / write.
   Never trust an org id straight off the request without re-verifying.

### Storage backend

Production: Neon Postgres via `postgres-js` + Drizzle (`getDb()` in
`src/db/client.ts`).
Test/CI: `@electric-sql/pglite` in-memory — same Postgres dialect, zero
network, instantiated fresh per test (`createTestDb()` in
`src/db/test-db.ts`). The schema is applied programmatically in
`src/db/migrate.ts` until drizzle-kit migrations are wired up.

## Why

- **Postgres over Clerk-as-data**: Clerk has Organizations of its own but
  putting business data in Clerk would lock us in completely. Orgs/memberships
  live in our DB; Clerk is identity only. We sync the Clerk user id into
  `users.id` on first login.
- **Owner/member**: smallest role set that covers "the person who created the
  org can delete it" vs "everyone else." Anything richer is YAGNI until we
  have a real customer asking for it.
- **One module to swap auth**: Clerk's `auth()` import works server-side in
  Next 16, but if we sprinkle it across components, swapping to Auth.js or
  WorkOS later becomes a refactor. A single `auth/context.ts` keeps it to a
  one-file change.
- **PGlite for tests**: same dialect as Neon, no Docker, fast enough. Drizzle
  has first-class PGlite support. The alternative (sqlite via better-sqlite3)
  has subtle dialect differences in `now()` / timestamptz / `ON CONFLICT`
  semantics that would bite us later.

## Consequences

- We are tied to Clerk's user id namespace. If we ever migrate auth providers
  we'll need to remap the `users.id` column. The `auth_provider_id` field
  exists to make that remap mechanical.
- Every new tenant-scoped query MUST go through the scoping helpers. A code
  review checklist enforces this until lint rules can. Direct
  `db.select().from(metrics)` without an `orgId` predicate is a bug.
- We cannot deploy auth-protected features on GitHub Pages — static export
  has no server. GEM-5's "deployed preview" success criterion is therefore
  blocked on the Vercel/Neon/Clerk provisioning task.

## Follow-ups

- GEM-7 (to be created): Provision Clerk + Neon + Vercel; populate
  `CLERK_*` / `DATABASE_URL` secrets; switch off `output: "export"`.
- GEM-8 (to be created): Sign-up / login / org-create UI, gated routes,
  Clerk webhook → `users` table sync.
- drizzle-kit migration scaffolding once we have a real `DATABASE_URL` to
  introspect against.
