import "server-only";

import {
  CODE_ARTIFACT_DOCUMENT_KEY,
  type CodeArtifact,
  parseCodeArtifact,
  serializeCodeArtifact,
} from "./code-artifact";

export interface PaperclipClientConfig {
  apiUrl: string;
  apiKey: string;
  companyId: string;
  runId?: string;
}

export function paperclipConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PaperclipClientConfig {
  const apiUrl = env.PAPERCLIP_API_URL;
  const apiKey = env.PAPERCLIP_API_KEY;
  const companyId = env.PAPERCLIP_COMPANY_ID;
  if (!apiUrl || !apiKey || !companyId) {
    throw new Error(
      "Mission Control: PAPERCLIP_API_URL, PAPERCLIP_API_KEY, and PAPERCLIP_COMPANY_ID must be set.",
    );
  }
  return { apiUrl, apiKey, companyId, runId: env.PAPERCLIP_RUN_ID };
}

function headers(config: PaperclipClientConfig) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
  if (config.runId) h["X-Paperclip-Run-Id"] = config.runId;
  return h;
}

interface IssueSummary {
  id: string;
  identifier: string;
}

export async function findIssueByIdentifier(
  config: PaperclipClientConfig,
  identifier: string,
): Promise<IssueSummary | null> {
  const url = `${config.apiUrl}/api/companies/${config.companyId}/issues?q=${encodeURIComponent(identifier)}`;
  const res = await fetch(url, { headers: headers(config) });
  if (!res.ok) throw new Error(`Paperclip search failed: ${res.status} ${await res.text()}`);
  const issues = (await res.json()) as IssueSummary[];
  return issues.find((i) => i.identifier === identifier) ?? null;
}

interface DocumentResponse {
  body: string;
  latestRevisionId: string;
}

export async function getCodeArtifact(
  config: PaperclipClientConfig,
  issueId: string,
): Promise<{ artifact: CodeArtifact | null; baseRevisionId: string | null }> {
  const url = `${config.apiUrl}/api/issues/${issueId}/documents/${CODE_ARTIFACT_DOCUMENT_KEY}`;
  const res = await fetch(url, { headers: headers(config) });
  if (res.status === 404) return { artifact: null, baseRevisionId: null };
  if (!res.ok) throw new Error(`Paperclip document fetch failed: ${res.status} ${await res.text()}`);
  const doc = (await res.json()) as DocumentResponse;
  return {
    artifact: parseCodeArtifact(doc.body),
    baseRevisionId: doc.latestRevisionId ?? null,
  };
}

export async function putCodeArtifact(
  config: PaperclipClientConfig,
  issueId: string,
  artifact: CodeArtifact,
  baseRevisionId: string | null,
): Promise<{ latestRevisionId: string }> {
  const doc = serializeCodeArtifact(artifact);
  const url = `${config.apiUrl}/api/issues/${issueId}/documents/${CODE_ARTIFACT_DOCUMENT_KEY}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: headers(config),
    body: JSON.stringify({ ...doc, baseRevisionId }),
  });
  if (!res.ok) throw new Error(`Paperclip document write failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { latestRevisionId: string };
  return { latestRevisionId: body.latestRevisionId };
}
