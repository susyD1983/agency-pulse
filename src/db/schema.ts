import { pgTable, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    slugUnique: uniqueIndex("organizations_slug_unique").on(t.slug),
  }),
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    authProviderId: text("auth_provider_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    emailUnique: uniqueIndex("users_email_unique").on(t.email),
    authProviderUnique: uniqueIndex("users_auth_provider_unique").on(t.authProviderId),
  }),
);

export type MembershipRole = "owner" | "member";

export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<MembershipRole>().notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    orgUserUnique: uniqueIndex("memberships_org_user_unique").on(t.orgId, t.userId),
    userIdx: index("memberships_user_idx").on(t.userId),
  }),
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [memberships.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
}));

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
