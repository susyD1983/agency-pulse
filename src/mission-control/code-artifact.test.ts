import { describe, expect, it } from "vitest";

import {
  CODE_ARTIFACT_SCHEMA_VERSION,
  type CodeArtifact,
  extractIssueIdentifier,
  mergeCodeArtifact,
  parseCodeArtifact,
  serializeCodeArtifact,
} from "./code-artifact";

const sample: CodeArtifact = {
  schemaVersion: CODE_ARTIFACT_SCHEMA_VERSION,
  issueIdentifier: "GEM-22",
  provider: "github",
  repositoryUrl: "https://github.com/susyD1983/agency-pulse",
  branchName: "proof/gem-21-spine",
  prUrl: "https://github.com/susyD1983/agency-pulse/pull/1",
  prNumber: 1,
  prState: "merged",
  commitShas: ["83cb54c827d03a3f4de090e234e789ab85ef7e38"],
  mergeCommitSha: "932ee15",
  updatedAt: "2026-06-11T11:43:10.541Z",
};

describe("code-artifact serialization", () => {
  it("round-trips a fully populated artifact", () => {
    const doc = serializeCodeArtifact(sample);
    const parsed = parseCodeArtifact(doc.body);
    expect(parsed).toEqual(sample);
  });

  it("preserves human-readable summary in the markdown body", () => {
    const doc = serializeCodeArtifact(sample);
    expect(doc.body).toContain("Provider: github");
    expect(doc.body).toContain("https://github.com/susyD1983/agency-pulse/pull/1");
    expect(doc.body).toContain("Merge commit: 932ee15");
  });

  it("returns null when the fenced block is missing", () => {
    expect(parseCodeArtifact("# random markdown\n\njust prose")).toBeNull();
  });

  it("returns null on a schema-version mismatch", () => {
    const doc = serializeCodeArtifact(sample);
    const tampered = doc.body.replace(/"schemaVersion": 1/, '"schemaVersion": 99');
    expect(parseCodeArtifact(tampered)).toBeNull();
  });
});

describe("extractIssueIdentifier", () => {
  it("pulls the identifier from a branch name", () => {
    expect(extractIssueIdentifier("feat/GEM-23/code-artifact")).toBe("GEM-23");
  });

  it("falls back across sources", () => {
    expect(extractIssueIdentifier(null, "PR: PAP-512 — fix the thing")).toBe("PAP-512");
  });

  it("returns null when no identifier is present", () => {
    expect(extractIssueIdentifier("main", "release v1")).toBeNull();
  });
});

describe("mergeCodeArtifact", () => {
  it("accumulates unique commit SHAs across events", () => {
    const first: CodeArtifact = { ...sample, commitShas: ["aaa"], mergeCommitSha: null, prState: "open" };
    const second: CodeArtifact = { ...sample, commitShas: ["bbb", "aaa"], mergeCommitSha: null, prState: "open" };
    expect(mergeCodeArtifact(first, second).commitShas).toEqual(["aaa", "bbb"]);
  });

  it("retains a recorded merge SHA when a later event omits it", () => {
    const merged: CodeArtifact = { ...sample };
    const reSync: CodeArtifact = { ...sample, mergeCommitSha: null, prState: "open" };
    const result = mergeCodeArtifact(merged, reSync);
    expect(result.mergeCommitSha).toBe(sample.mergeCommitSha);
    expect(result.prState).toBe("open");
  });
});
