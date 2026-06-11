/**
 * Build a Mission Control code-artifact from a GitHub pull_request webhook
 * payload. The pure function is exported so the same logic runs from a Next.js
 * route handler, a GitHub Actions ingestion job, or a unit test.
 */

import {
  CODE_ARTIFACT_SCHEMA_VERSION,
  type CodeArtifact,
  extractIssueIdentifier,
} from "./code-artifact";

export interface GithubPullRequestEvent {
  action: string;
  pull_request: {
    number: number;
    state: "open" | "closed";
    merged: boolean;
    merge_commit_sha: string | null;
    title: string;
    body: string | null;
    html_url: string;
    head: { ref: string; sha: string };
    base: { ref: string };
  };
  repository: {
    html_url: string;
    full_name: string;
  };
}

export interface BuiltArtifact {
  issueIdentifier: string;
  artifact: CodeArtifact;
}

export function buildArtifactFromPullRequest(event: GithubPullRequestEvent): BuiltArtifact | null {
  const pr = event.pull_request;
  const issueIdentifier = extractIssueIdentifier(pr.head.ref, pr.title, pr.body);
  if (!issueIdentifier) return null;

  const merged = pr.merged === true;
  const prState: CodeArtifact["prState"] = merged ? "merged" : pr.state;
  const commitShas = pr.head.sha ? [pr.head.sha] : [];

  const artifact: CodeArtifact = {
    schemaVersion: CODE_ARTIFACT_SCHEMA_VERSION,
    issueIdentifier,
    provider: "github",
    repositoryUrl: event.repository.html_url,
    branchName: pr.head.ref,
    prUrl: pr.html_url,
    prNumber: pr.number,
    prState,
    commitShas,
    mergeCommitSha: merged ? pr.merge_commit_sha : null,
    updatedAt: new Date().toISOString(),
  };

  return { issueIdentifier, artifact };
}
