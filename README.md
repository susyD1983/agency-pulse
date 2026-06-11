# Agency Pulse

The COO dashboard for modern agencies.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Vitest · ESLint + Prettier.
See [docs/adr/0001-stack.md](docs/adr/0001-stack.md) for the rationale and the
data, auth, and hosting picks.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command                | What it does                |
| ---------------------- | --------------------------- |
| `npm run dev`          | Next dev server             |
| `npm run build`        | Production build            |
| `npm run lint`         | ESLint                      |
| `npm run typecheck`    | `tsc --noEmit`              |
| `npm run format`       | Prettier write              |
| `npm run format:check` | Prettier check (used in CI) |
| `npm test`             | Vitest (one-shot)           |
| `npm run test:watch`   | Vitest watch                |

## CI / deploy

- Every PR runs `.github/workflows/ci.yml`: format, lint, typecheck, test, build.
- `main` deploys a static export to GitHub Pages via
  `.github/workflows/pages.yml`. This is the current public URL.
- Per-PR preview URLs land when the repo is connected to Vercel (tracked as a
  follow-up issue).
