import { describe, expect, it } from "vitest";

import { buildArtifactFromPullRequest, type GithubPullRequestEvent } from "./github-ingest";

function makeEvent(overrides: Partial<GithubPullRequestEvent["pull_request"]> = {}): GithubPullRequestEvent {
  return {
    action: "closed",
    pull_request: {
      number: 1,
      state: "closed",
      merged: true,
      merge_commit_sha: "932ee15",
      title: "GEM-21: Mission Control spine proof file",
      body: "Closes [GEM-22](/GEM/issues/GEM-22)",
      html_url: "https://github.com/susyD1983/agency-pulse/pull/1",
      head: { ref: "proof/gem-21-spine", sha: "83cb54c827d03a3f4de090e234e789ab85ef7e38" },
      base: { ref: "main" },
      ...overrides,
    },
    repository: {
      html_url: "https://github.com/susyD1983/agency-pulse",
      full_name: "susyD1983/agency-pulse",
    },
  };
}

describe("buildArtifactFromPullRequest", () => {
  it("extracts a merged PR into a typed code-artifact", () => {
    const result = buildArtifactFromPullRequest(makeEvent());
    expect(result).not.toBeNull();
    expect(result!.issueIdentifier).toBe("GEM-21");
    expect(result!.artifact).toMatchObject({
      provider: "github",
      branchName: "proof/gem-21-spine",
      prUrl: "https://github.com/susyD1983/agency-pulse/pull/1",
      prNumber: 1,
      prState: "merged",
      mergeCommitSha: "932ee15",
    });
    expect(result!.artifact.commitShas).toContain("83cb54c827d03a3f4de090e234e789ab85ef7e38");
  });

  it("falls back to PR body when branch and title have no identifier", () => {
    const result = buildArtifactFromPullRequest(
      makeEvent({ head: { ref: "feature/cleanup", sha: "abc" }, title: "Cleanup", body: "Refs GEM-99" }),
    );
    expect(result?.issueIdentifier).toBe("GEM-99");
  });

  it("returns null when no identifier can be found", () => {
    const result = buildArtifactFromPullRequest(
      makeEvent({ head: { ref: "main", sha: "abc" }, title: "nothing", body: null }),
    );
    expect(result).toBeNull();
  });

  it("marks an open PR without a merge SHA", () => {
    const result = buildArtifactFromPullRequest(
      makeEvent({ state: "open", merged: false, merge_commit_sha: null }),
    );
    expect(result?.artifact.prState).toBe("open");
    expect(result?.artifact.mergeCommitSha).toBeNull();
  });
});
