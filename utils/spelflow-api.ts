import { getAuthToken } from './auth';
import type { CapturedIssue, SpelflowWorkspace, SpelflowProject } from './types';

const BASE = 'https://app.spelflow.ru/account/api/v1';

async function authFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = await getAuthToken();
  if (!token) throw new Error('Not authenticated');
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
}

export async function getWorkspaces(): Promise<SpelflowWorkspace[]> {
  const res = await authFetch('/workspaces');
  if (!res.ok) throw new Error(`getWorkspaces failed: ${res.status}`);
  return res.json();
}

export async function getProjects(workspaceUrl: string): Promise<SpelflowProject[]> {
  const res = await authFetch(`/workspaces/${workspaceUrl}/projects`);
  if (!res.ok) throw new Error(`getProjects failed: ${res.status}`);
  return res.json();
}

export async function createIssue(
  workspaceUrl: string,
  projectIdentifier: string,
  issue: CapturedIssue
): Promise<{ id: string; identifier: string }> {
  const description =
    issue.body +
    `\n\n---\n🔗 Imported from ${issue.provider} · [${issue.externalId}](${issue.externalUrl})`;

  const res = await authFetch(`/workspaces/${workspaceUrl}/issues`, {
    method: 'POST',
    body: JSON.stringify({
      title: issue.title,
      project: projectIdentifier,
      description,
    }),
  });
  if (!res.ok) throw new Error(`createIssue failed: ${res.status} ${await res.text()}`);
  return res.json();
}
