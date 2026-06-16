import './style.css';
import { reviewBasket, authToken, lastWorkspace, lastProject } from '../../utils/storage';
import { getWorkspaces, getProjects, createIssue } from '../../utils/spelflow-api';
import type { CapturedIssue, ImportStatus, SpelflowWorkspace, SpelflowProject } from '../../utils/types';

interface IssueState {
  issue: CapturedIssue;
  status: ImportStatus;
  spelflowUrl?: string;
  errorMessage?: string;
}

let issueStates: IssueState[] = [];
let workspaces: SpelflowWorkspace[] = [];
let projects: SpelflowProject[] = [];

async function init() {
  const token = await authToken.getValue();
  if (!token) {
    showState('not-connected');
    return;
  }

  const basket = await reviewBasket.getValue();
  if (basket.length === 0) {
    showState('empty');
    return;
  }

  issueStates = basket.map((issue) => ({ issue, status: 'pending' }));

  try {
    workspaces = await getWorkspaces();
    renderWorkspaceSelector();
    await loadProjects();
  } catch {
    // still show issues even if workspace load fails
  }

  renderIssues();
  updateImportButton();
}

function showState(state: 'empty' | 'not-connected' | 'list') {
  document.getElementById('state-empty')?.classList.toggle('hidden', state !== 'empty');
  document.getElementById('state-not-connected')?.classList.toggle('hidden', state !== 'not-connected');
  document.getElementById('issue-list')?.classList.toggle('hidden', state !== 'list');
}

function renderWorkspaceSelector() {
  const selWs = document.getElementById('sel-workspace') as HTMLSelectElement;
  selWs.innerHTML = workspaces.map((w) => `<option value="${w.url}">${w.name}</option>`).join('');

  const saved = lastWorkspace.getValue();
  void saved.then((ws) => {
    if (ws) selWs.value = ws.url;
  });

  selWs.addEventListener('change', async () => {
    const ws = workspaces.find((w) => w.url === selWs.value);
    if (ws) {
      await lastWorkspace.setValue(ws);
      await loadProjects();
      updateImportButton();
    }
  });

  document.getElementById('workspace-selector')?.classList.remove('hidden');
}

async function loadProjects() {
  const selWs = document.getElementById('sel-workspace') as HTMLSelectElement;
  const wsUrl = selWs?.value;
  if (!wsUrl) return;

  const selPj = document.getElementById('sel-project') as HTMLSelectElement;
  try {
    projects = await getProjects(wsUrl);
    selPj.innerHTML = projects.map((p) => `<option value="${p.identifier}">${p.name}</option>`).join('');

    const saved = await lastProject.getValue();
    if (saved) selPj.value = saved.identifier;

    selPj.removeEventListener('change', onProjectChange);
    selPj.addEventListener('change', onProjectChange);
  } catch {
    selPj.innerHTML = '<option>Failed to load</option>';
  }
}

async function onProjectChange() {
  const selPj = document.getElementById('sel-project') as HTMLSelectElement;
  const project = projects.find((p) => p.identifier === selPj.value);
  if (project) await lastProject.setValue(project);
  updateImportButton();
}

function renderIssues() {
  showState('list');
  const list = document.getElementById('issue-list')!;
  list.innerHTML = '';

  if (issueStates.length === 0) {
    showState('empty');
    return;
  }

  issueStates.forEach((state, index) => {
    const card = document.createElement('div');
    card.className = `issue-card ${state.status === 'done' ? 'done' : ''} ${state.status === 'error' ? 'error' : ''}`;
    card.id = `card-${index}`;

    const statusText = {
      pending: 'Pending',
      importing: 'Importing…',
      done: state.spelflowUrl ? `<a class="issue-link" href="${state.spelflowUrl}" target="_blank">Imported ↗</a>` : 'Imported',
      error: `<span title="${state.errorMessage ?? ''}">Error</span>`,
    }[state.status];

    card.innerHTML = `
      <div class="issue-info">
        <div class="issue-title">${escapeHtml(state.issue.title)}</div>
        <div class="issue-meta">
          <span class="provider-badge">${state.issue.provider}</span>
          <a class="issue-link" href="${state.issue.externalUrl}" target="_blank">${escapeHtml(state.issue.externalId)}</a>
        </div>
      </div>
      <div class="issue-status status-${state.status}">${statusText}</div>
      ${state.status === 'pending' ? `<button class="btn-remove" data-index="${index}" title="Remove from basket">✕</button>` : ''}
    `;

    list.appendChild(card);
  });

  list.querySelectorAll<HTMLButtonElement>('.btn-remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset['index'] ?? '0', 10);
      issueStates.splice(idx, 1);
      await reviewBasket.setValue(issueStates.map((s) => s.issue));
      renderIssues();
      updateImportButton();
    });
  });
}

function updateCardStatus(index: number) {
  const state = issueStates[index];
  if (!state) return;
  const card = document.getElementById(`card-${index}`);
  if (!card) return;
  card.className = `issue-card ${state.status === 'done' ? 'done' : ''} ${state.status === 'error' ? 'error' : ''}`;

  const statusEl = card.querySelector<HTMLElement>('.issue-status');
  if (statusEl) {
    statusEl.className = `issue-status status-${state.status}`;
    const map: Record<ImportStatus, string> = {
      pending: 'Pending',
      importing: 'Importing…',
      done: state.spelflowUrl ? `<a class="issue-link" href="${state.spelflowUrl}" target="_blank">Imported ↗</a>` : 'Imported',
      error: `<span title="${state.errorMessage ?? ''}">Error</span>`,
    };
    statusEl.innerHTML = map[state.status];
  }

  const removeBtn = card.querySelector<HTMLButtonElement>('.btn-remove');
  if (state.status !== 'pending' && removeBtn) removeBtn.remove();
}

function updateImportButton() {
  const btn = document.getElementById('btn-import-all') as HTMLButtonElement;
  const selWs = document.getElementById('sel-workspace') as HTMLSelectElement;
  const selPj = document.getElementById('sel-project') as HTMLSelectElement;
  const hasPending = issueStates.some((s) => s.status === 'pending');
  const hasTargets = selWs?.value && selPj?.value;
  btn.disabled = !hasPending || !hasTargets;
}

async function importAll() {
  const selWs = document.getElementById('sel-workspace') as HTMLSelectElement;
  const selPj = document.getElementById('sel-project') as HTMLSelectElement;
  const wsUrl = selWs?.value;
  const projectId = selPj?.value;
  if (!wsUrl || !projectId) return;

  const btn = document.getElementById('btn-import-all') as HTMLButtonElement;
  btn.disabled = true;

  const pending = issueStates
    .map((s, i) => ({ state: s, index: i }))
    .filter(({ state }) => state.status === 'pending');

  for (const { state, index } of pending) {
    state.status = 'importing';
    updateCardStatus(index);

    try {
      const result = await createIssue(wsUrl, projectId, state.issue);
      state.status = 'done';
      state.spelflowUrl = `https://app.spelflow.ru/workbench/${wsUrl}/tracker/${result.identifier}`;
    } catch (err) {
      state.status = 'error';
      state.errorMessage = err instanceof Error ? err.message : 'Unknown error';
    }

    updateCardStatus(index);
  }

  await reviewBasket.setValue(
    issueStates.filter((s) => s.status !== 'done').map((s) => s.issue)
  );

  updateImportButton();
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.getElementById('btn-import-all')?.addEventListener('click', importAll);

document.getElementById('btn-clear')?.addEventListener('click', async () => {
  await reviewBasket.setValue([]);
  issueStates = [];
  showState('empty');
  updateImportButton();
});

reviewBasket.watch(async (newBasket) => {
  if (newBasket.length > issueStates.length) {
    const existing = new Set(issueStates.map((s) => s.issue.externalUrl));
    const added = newBasket.filter((i) => !existing.has(i.externalUrl));
    issueStates.push(...added.map((issue) => ({ issue, status: 'pending' as ImportStatus })));
    renderIssues();
    updateImportButton();
  }
});

init();
