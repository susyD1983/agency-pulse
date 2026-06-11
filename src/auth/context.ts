import "server-only";
import type { MembershipRole } from "@/db/schema";

export type AuthContext = {
  userId: string;
  orgId: string;
  role: MembershipRole;
};

export class OrgAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrgAccessError";
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/**
 * Resolves the active auth context for the current request.
 *
 * Returns `null` when no user is signed in. Implemented as a stub today —
 * GEM-7 (Clerk wiring) replaces the body with a real Clerk lookup. Callers
 * must therefore *never* read identity from cookies/headers directly; always
 * go through this boundary so the swap stays local.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  // Intentionally returns null until Clerk is wired up. Pages/route handlers
  // that need auth should call `requireAuthContext` and let it 401.
  return null;
}

export async function requireAuthContext(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new UnauthenticatedError();
  return ctx;
}
