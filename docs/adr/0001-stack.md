# ADR 0001 — Initial stack for Agency Pulse

Status: Accepted
Date: 2026-06-10
Driving issue: [GEM-3](/GEM/issues/GEM-3) (canonical) — Pick stack, bootstrap repo, set up CI/preview deploys
Duplicate issues, since cancelled / to-cancel: [GEM-2](/GEM/issues/GEM-2), [GEM-4](/GEM/issues/GEM-4)

## Context

Agency Pulse is the COO dashboard product Gemini is building. We need a stack
that lets a single founding engineer ship the next several issues fast, hires
well, and is a two-way door we can replace later without re-litigating each
decision.

## Decisions

| Concern        | Choice                                          |
| -------------- | ----------------------------------------------- |
| Framework      | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling        | Tailwind CSS v4                                 |
| Lint / format  | ESLint (`eslint-config-next`) + Prettier        |
| Tests          | Vitest + Testing Library + jsdom                |
| Database       | Postgres on Neon (serverless, branchable)       |
| ORM            | Drizzle                                         |
| Auth           | Clerk                                           |
| Hosting (prod) | Vercel                                          |
| Hosting (now)  | GitHub Pages (static export)                    |
| CI             | GitHub Actions: lint + typecheck + test + build |
| Observability  | Vercel logs + Sentry (added when first user)    |

## Why

- **Next.js + Vercel** is the boring, well-trodden full-stack path. Owning a
  COO dashboard means we need server-rendered pages, API routes, edge auth, and
  fast iteration. One framework, one deploy target. Vercel gives us per-PR
  preview URLs as a checkbox feature.
- **Postgres / Drizzle / Neon**: Postgres is the universal default. Drizzle is
  TypeScript-native, generates fast migrations, has no runtime magic. Neon's
  database branching mirrors our preview-deploy story so a PR can run against
  isolated data later if we need it.
- **Clerk**: drop-in auth that supports orgs/teams out of the box, which is the
  shape an agency tool needs. Two-way door — we can swap to Auth.js or
  WorkOS later by replacing one provider boundary.
- **ESLint + Prettier + Vitest**: the most boring possible JS toolchain. Every
  engineer we hire has used these. We considered Biome for speed; rejected
  because the ecosystem fit isn't yet worth the novelty cost.
- **GitHub Pages as today's URL**: Vercel needs the CEO to attach a Vercel
  account to the GitHub repo. Until that happens we ship a static export to
  Pages so we hit the success criterion of "a deployed URL I can open" without
  blocking on account setup. The `next.config.ts` keeps `output: "export"` so
  the same build artifact deploys on either target.

## Consequences

- We are coupled to Next.js conventions. Worth it for now; if we ever split the
  API into a separate service (Hono, Fastify), the boundary already exists at
  `/app/api/*`.
- Static export means anything requiring SSR/route handlers cannot ship to
  GitHub Pages. The moment we add a real API route we must switch hosting to
  Vercel (or another Node host). That is the trigger to escalate the Vercel
  connect to the CEO.
- Drizzle, Clerk, and Neon are not installed yet. They are decided, not yet
  wired. The first issue that needs them (likely the first authenticated page
  or the first data model) will pull them in.

## Two-way door notes

- Framework: replaceable with Remix/SvelteKit if Next.js becomes painful, but
  requires rewriting routing and data fetching.
- ORM: Drizzle → Prisma is straightforward; both are schema-first.
- Auth: Clerk → Auth.js needs a session abstraction. Plan to keep auth checks
  behind a single helper from day one.
- Hosting: Vercel → Cloudflare Pages or Fly is a Dockerfile away once we add
  real server logic.
