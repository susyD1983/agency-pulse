/**
 * Mission Control — code-artifact binding (Layer 1).
 *
 * The board directive (GEM-23) is to attach a typed task→code binding to every
 * Paperclip issue without text-mining comments. We use Paperclip's existing
 * issue-document primitive (key `code-artifact`) as the structured store, so
 * Paperclip remains the source of truth and no parallel Mission Control system
 * is introduced.
 *
 * The document body is markdown with one fenced ```json block tagged
 * `mc:code-artifact` that holds the structured payload. This keeps the
 * document human-readable in the Paperclip UI while staying machine-parseable.
 */

export const CODE_ARTIFACT_DOCUMENT_KEY = "code-artifact";
export const CODE_ARTIFACT_SCHEMA_VERSION = 1;
export const CODE_ARTIFACT_FENCE_TAG = "mc:code-artifact";

export type CodeArtifactProvider = "github" | "gitlab" | "bitbucket" | "other";

export interface CodeArtifact {
  schemaVersion: typeof CODE_ARTIFACT_SCHEMA_VERSION;
  issueIdentifier: string;
  provider: CodeArtifactProvider;
  repositoryUrl: string;
  branchName: string | null;
  prUrl: string | null;
  prNumber: number | null;
  prState: "open" | "closed" | "merged" | null;
  commitShas: string[];
  mergeCommitSha: string | null;
  updatedAt: string;
}

export interface CodeArtifactDocument {
  title: string;
  format: "markdown";
  body: string;
}

const ISSUE_IDENTIFIER_REGEX = /\b([A-Z][A-Z0-9]+-\d+)\b/;

export function extractIssueIdentifier(...sources: Array<string | null | undefined>): string | null {
  for (const source of sources) {
    if (!source) continue;
    const match = source.match(ISSUE_IDENTIFIER_REGEX);
    if (match) return match[1];
  }
  return null;
}

export function serializeCodeArtifact(artifact: CodeArtifact): CodeArtifactDocument {
  const json = JSON.stringify(artifact, null, 2);
  const body = [
    `# Code artifact — ${artifact.issueIdentifier}`,
    "",
    "Structured task → code binding written by Mission Control. Do not edit by hand; this document is rewritten on every GitHub PR event for this issue.",
    "",
    summarizeArtifact(artifact),
    "",
    "```json " + CODE_ARTIFACT_FENCE_TAG,
    json,
    "```",
    "",
  ].join("\n");
  return {
    title: `Code artifact — ${artifact.issueIdentifier}`,
    format: "markdown",
    body,
  };
}

export function parseCodeArtifact(body: string): CodeArtifact | null {
  const fenceRegex = new RegExp(
    "```json\\s+" + CODE_ARTIFACT_FENCE_TAG + "\\s*\\n([\\s\\S]*?)\\n```",
    "m",
  );
  const match = body.match(fenceRegex);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[1]);
    if (!raw || typeof raw !== "object") return null;
    if (raw.schemaVersion !== CODE_ARTIFACT_SCHEMA_VERSION) return null;
    return raw as CodeArtifact;
  } catch {
    return null;
  }
}

function summarizeArtifact(a: CodeArtifact): string {
  const lines = [
    `- Provider: ${a.provider}`,
    `- Repository: ${a.repositoryUrl}`,
    `- Branch: ${a.branchName ?? "_n/a_"}`,
    `- PR: ${a.prUrl ?? "_n/a_"}${a.prState ? ` (${a.prState})` : ""}`,
    `- Merge commit: ${a.mergeCommitSha ?? "_n/a_"}`,
    `- Commits: ${a.commitShas.length === 0 ? "_none recorded_" : a.commitShas.join(", ")}`,
    `- Updated: ${a.updatedAt}`,
  ];
  return lines.join("\n");
}

/**
 * Merge a previously-stored artifact with a freshly-derived one. Used by the
 * GitHub ingestion path so that successive PR events accumulate commit SHAs
 * instead of overwriting them, and so a synchronize event after a merge does
 * not clobber the merge SHA.
 */
export function mergeCodeArtifact(prev: CodeArtifact | null, next: CodeArtifact): CodeArtifact {
  if (!prev) return next;
  const commits = Array.from(new Set([...prev.commitShas, ...next.commitShas]));
  return {
    ...next,
    commitShas: commits,
    mergeCommitSha: next.mergeCommitSha ?? prev.mergeCommitSha,
    prState: next.prState ?? prev.prState,
  };
}
