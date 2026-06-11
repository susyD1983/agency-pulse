# ADR 0003 — Mission Control Layer 1: code-artifact binding

Status: Accepted
Date: 2026-06-11
Driving issue: [GEM-23](/GEM/issues/GEM-23) — Mission Control Layer 1: add structured codeArtifact binding to issues
Parent proof: [GEM-21](/GEM/issues/GEM-21) — Mission Control Foundation Proof
Proof implementation: [GEM-22](/GEM/issues/GEM-22) — Mission Control spine proof file

## Context

GEM-21 verified that Paperclip already covers 7/9 spine checkpoints natively.
The smallest remaining gap for Mission Control is that the link between a
Paperclip issue and the code it produced — branch, commit SHAs, PR URL, merge
commit — currently lives only in comment prose. A dashboard cannot answer
"what code did this task ship?" without text-mining comments.

The directive is to add the smallest useful layer **on top of Paperclip** —
preserve Paperclip as source of truth, do not rebuild Mission Control as a
parallel system, and do not introduce Streamlit/FastAPI/LangGraph/PocketBase/
Qdrant/mem0/SearxNG/OpenClaw/Telegram/MoA.

## Decision

Store the typed task→code binding as a Paperclip **issue document** with key
`code-artifact`, written by Mission Control on every GitHub PR event for the
matching issue.

| Concern         | Choice                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Storage         | Paperclip `issue_documents` row, key `code-artifact`, markdown body with one fenced ```json mc:code-artifact``` block |
| Schema          | `CodeArtifact` (see `src/mission-control/code-artifact.ts`) — versioned (`schemaVersion: 1`)                 |
| Source of truth | Paperclip — every Mission Control read parses the latest document revision                                   |
| Ingestion       | Pure transform `buildArtifactFromPullRequest` invoked by either a GH Actions step (today) or a Vercel route handler (when wired) |
| Identifier match| Regex `[A-Z][A-Z0-9]+-\d+` against PR head branch → title → body, first hit wins                              |
| Idempotency     | Accumulate commit SHAs via `mergeCodeArtifact`; never clobber a recorded merge SHA on a follow-up event      |

## Why issue documents and not a new table

- Paperclip already exposes typed `PUT/GET /api/issues/{id}/documents/{key}`
  with revision history, run-id audit, and dashboard visibility. Adding a new
  table to Paperclip core requires shipping Paperclip itself; documents are an
  agent-writable primitive that ships today.
- Markdown bodies stay human-readable in the Paperclip UI. The fenced JSON
  block is machine-parseable and version-tagged.
- Document revisions give us a free audit trail of how the artifact evolved
  across PR events (open → synchronize → closed/merged).

## Ingestion path

The ingestion path has two equivalent implementations of one pure transform:

1. **Today — GH Actions step.** `scripts/mc-ingest-pr.mjs` reads
   `$GITHUB_EVENT_PATH`, builds the artifact, finds the matching Paperclip
   issue, and `PUT`s the document. The workflow is parked in
   `docs/ci/mc-ingest-pr.yml.pending` (per ADR 0001's CI pattern); activate it
   once `gh` has the `workflow` scope and the three `PAPERCLIP_*` repo secrets
   are set.
2. **When Vercel ships — HTTP webhook.** `docs/ci/mc-github-webhook.route.ts.pending`
   is the parked Next.js route handler. It verifies the GitHub HMAC and calls
   the same `buildArtifactFromPullRequest` transform. Move it to
   `src/app/api/mc/github-webhook/route.ts` once `output: "export"` is removed
   from `next.config.ts` (the same trigger ADR 0001 already named).

Both paths share `src/mission-control/github-ingest.ts`, which is unit-tested
in `src/mission-control/github-ingest.test.ts`. The `.mjs` CLI inlines the
same logic so Node can run it without a TS toolchain.

## Acceptance evidence

- Round-trip tests in `src/mission-control/code-artifact.test.ts` prove the
  schema serializes deterministically and parses back to the same object.
- Ingestion tests in `src/mission-control/github-ingest.test.ts` prove the
  transform handles merged, open, body-only-identifier, and no-identifier PRs.
- Live proof: GEM-22's `code-artifact` document was populated with the real
  PR #1 data from the GEM-21 spine proof (branch `proof/gem-21-spine`, commit
  `83cb54c…`, PR `…/pull/1`, merge `932ee15`). See the
  comment thread on [GEM-23](/GEM/issues/GEM-23) for the document revision id.

## Obsidian export note (one-way consumer)

A future Obsidian export (Mission Control read model) should treat the
`code-artifact` document as the authoritative task→code binding:

1. List issues via the Paperclip API.
2. For each, `GET /api/issues/{id}/documents/code-artifact`; if 404, skip.
3. Parse the fenced ```json mc:code-artifact``` block — fall back to nothing
   if `schemaVersion !== 1` so a future bump can be handled explicitly.
4. Write one Obsidian note per issue with frontmatter mirroring the
   `CodeArtifact` fields. Paperclip remains source of truth; Obsidian is a
   read-only mirror. Never write back.

## Consequences

- Mission Control now reads task→code state structurally instead of regexing
  comments. The dashboard requirement from GEM-21 is unblocked.
- The webhook route still requires the Vercel cutover from ADR 0001 to ship.
  Until then, the GH Action ingestion path covers operational coverage and
  the unit tests + GEM-22 backfill cover correctness.
- Schema bumps are explicit (`schemaVersion`). The parser rejects unknown
  versions so a stale Mission Control reader can't silently misinterpret a
  newer artifact.

## Two-way door notes

- Storage swap: if Paperclip later adds a first-class `codeArtifact` column to
  issues, we delete the document and read from the column instead. The
  `CodeArtifact` TypeScript type stays the public contract for callers.
- Ingestion swap: replace the GH event source with GitLab/Bitbucket by adding
  sibling `build*FromMergeRequest` transforms and switching the workflow.
- Provider swap: the `provider` field is already typed for `gitlab`/`bitbucket`/`other`.
