#!/usr/bin/env node
/**
 * Mission Control — PR ingestion path (Layer 1).
 *
 * Reads a GitHub pull_request webhook payload from $GITHUB_EVENT_PATH (or the
 * first CLI argument) and writes a typed `code-artifact` document to the
 * matching Paperclip issue. Intended for use from a GitHub Actions step on
 * pull_request events; the same transform is implemented in
 * src/mission-control/github-ingest.ts and covered by unit tests there.
 *
 * Required env: PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID.
 * Optional env: PAPERCLIP_RUN_ID.
 */

import { readFileSync } from "node:fs";
import process from "node:process";

const SCHEMA_VERSION = 1;
const DOCUMENT_KEY = "code-artifact";
const FENCE_TAG = "mc:code-artifact";
const ISSUE_ID_REGEX = /\b([A-Z][A-Z0-9]+-\d+)\b/;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`mc-ingest-pr: missing env ${name}`);
    process.exit(2);
  }
  return v;
}

function extractIssueIdentifier(...sources) {
  for (const s of sources) {
    if (!s) continue;
    const m = String(s).match(ISSUE_ID_REGEX);
    if (m) return m[1];
  }
  return null;
}

function buildArtifact(event) {
  const pr = event.pull_request;
  if (!pr) return null;
  const id = extractIssueIdentifier(pr.head?.ref, pr.title, pr.body);
  if (!id) return null;
  const merged = pr.merged === true;
  return {
    issueIdentifier: id,
    artifact: {
      schemaVersion: SCHEMA_VERSION,
      issueIdentifier: id,
      provider: "github",
      repositoryUrl: event.repository.html_url,
      branchName: pr.head?.ref ?? null,
      prUrl: pr.html_url,
      prNumber: pr.number,
      prState: merged ? "merged" : pr.state,
      commitShas: pr.head?.sha ? [pr.head.sha] : [],
      mergeCommitSha: merged ? pr.merge_commit_sha : null,
      updatedAt: new Date().toISOString(),
    },
  };
}

function serializeBody(a) {
  return [
    `# Code artifact — ${a.issueIdentifier}`,
    "",
    "Structured task → code binding written by Mission Control. Do not edit by hand; this document is rewritten on every GitHub PR event for this issue.",
    "",
    `- Provider: ${a.provider}`,
    `- Repository: ${a.repositoryUrl}`,
    `- Branch: ${a.branchName ?? "_n/a_"}`,
    `- PR: ${a.prUrl ?? "_n/a_"}${a.prState ? ` (${a.prState})` : ""}`,
    `- Merge commit: ${a.mergeCommitSha ?? "_n/a_"}`,
    `- Commits: ${a.commitShas.length === 0 ? "_none recorded_" : a.commitShas.join(", ")}`,
    `- Updated: ${a.updatedAt}`,
    "",
    "```json " + FENCE_TAG,
    JSON.stringify(a, null, 2),
    "```",
    "",
  ].join("\n");
}

async function pcFetch(path, init = {}) {
  const apiUrl = requireEnv("PAPERCLIP_API_URL");
  const apiKey = requireEnv("PAPERCLIP_API_KEY");
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
  };
  if (process.env.PAPERCLIP_RUN_ID) headers["X-Paperclip-Run-Id"] = process.env.PAPERCLIP_RUN_ID;
  const res = await fetch(`${apiUrl}${path}`, { ...init, headers });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Paperclip ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

async function findIssue(identifier) {
  const companyId = requireEnv("PAPERCLIP_COMPANY_ID");
  const res = await pcFetch(`/api/companies/${companyId}/issues?q=${encodeURIComponent(identifier)}`);
  const issues = await res.json();
  return issues.find((i) => i.identifier === identifier) ?? null;
}

async function getDocument(issueId) {
  const res = await pcFetch(`/api/issues/${issueId}/documents/${DOCUMENT_KEY}`);
  if (res.status === 404) return null;
  return res.json();
}

async function putDocument(issueId, body, baseRevisionId, title) {
  const res = await pcFetch(`/api/issues/${issueId}/documents/${DOCUMENT_KEY}`, {
    method: "PUT",
    body: JSON.stringify({ title, format: "markdown", body, baseRevisionId }),
  });
  return res.json();
}

async function main() {
  const eventPath = process.argv[2] ?? process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.error("mc-ingest-pr: pass a PR event JSON path or set GITHUB_EVENT_PATH");
    process.exit(2);
  }
  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  const built = buildArtifact(event);
  if (!built) {
    console.log("mc-ingest-pr: no issue identifier found in branch/title/body — skipping");
    return;
  }
  const issue = await findIssue(built.issueIdentifier);
  if (!issue) {
    console.error(`mc-ingest-pr: no Paperclip issue matches ${built.issueIdentifier}`);
    process.exit(1);
  }
  const existing = await getDocument(issue.id);
  const baseRevisionId = existing?.latestRevisionId ?? null;
  const body = serializeBody(built.artifact);
  await putDocument(issue.id, body, baseRevisionId, `Code artifact — ${built.issueIdentifier}`);
  console.log(`mc-ingest-pr: wrote code-artifact for ${built.issueIdentifier} (${issue.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
