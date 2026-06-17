import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { reviewBasket, lastWorkspace, lastProject } from '../utils/storage';
import { listIssues } from '../utils/spelflow-api';
import { extractTaskContent, parseTaskIdFromUrl } from '../utils/gitverse';
import type { CapturedIssue } from '../utils/types';

export default defineContentScript({
  matches: ['*://gitverse.ru/*/*/tasktracker', '*://gitverse.ru/*/*/tasktracker?*'],
  async main(_ctx: ContentScriptContext) {
    injectBar();
    void refreshCount();
    observeMutations();
  },
});

interface TaskRow {
  taskId: string;
  url: string;
  title: string;
}

function findTaskRows(): TaskRow[] {
  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/tasktracker/"]'));
  const rows: TaskRow[] = [];
  const seen = new Set<string>();
  for (const a of anchors) {
    const taskId = parseTaskIdFromUrl(a.getAttribute('href') ?? '');
    if (!taskId || seen.has(taskId)) continue;
    const title = a.textContent?.trim();
    if (!title) continue;
    seen.add(taskId);
    rows.push({ taskId, url: a.href, title });
  }
  return rows;
}

// Every issue created by createIssue() gets a footer like
// "🔗 Imported from gitverse-tasktracker · [ID](https://gitverse.ru/.../TASK-1)".
// Pulling every markdown link target out of the description is enough to know
// which Gitverse URLs already exist in this Hub project, with no schema change.
function extractImportedUrls(issues: { description: string }[]): Set<string> {
  const urls = new Set<string>();
  const linkRe = /\((https?:\/\/[^\s)]+)\)/g;
  for (const issue of issues) {
    let match: RegExpExecArray | null;
    while ((match = linkRe.exec(issue.description))) {
      if (match[1]) urls.add(match[1]);
    }
  }
  return urls;
}

let hubUrlsCache: Set<string> | null = null;
let hubUrlsCacheKey: string | null = null;

async function getHubImportedUrls(): Promise<Set<string>> {
  const ws = await lastWorkspace.getValue();
  const project = await lastProject.getValue();
  if (!ws || !project) return new Set();

  const key = `${ws.url}:${project.identifier}`;
  if (hubUrlsCache && hubUrlsCacheKey === key) return hubUrlsCache;

  try {
    const issues = await listIssues(ws.url, project.identifier);
    hubUrlsCache = extractImportedUrls(issues);
    hubUrlsCacheKey = key;
    return hubUrlsCache;
  } catch {
    // Not connected, no workspace/project picked yet, or the request failed —
    // degrade to basket-only dedup rather than blocking the bulk capture.
    return new Set();
  }
}

async function getNewRows(): Promise<TaskRow[]> {
  const rows = findTaskRows();
  if (rows.length === 0) return [];

  const basket = await reviewBasket.getValue();
  const basketUrls = new Set(basket.map((i) => i.externalUrl));
  const hubUrls = await getHubImportedUrls();

  return rows.filter((r) => !basketUrls.has(r.url) && !hubUrls.has(r.url));
}

const BAR_STYLE = [
  'position:fixed',
  'bottom:24px',
  'right:24px',
  'z-index:2147483647',
  'display:flex',
  'align-items:center',
  'gap:0',
  'border-radius:6px',
  'box-shadow:0 2px 12px oklch(0 0 0 / 0.40)',
  'font-family:"IBM Plex Sans",-apple-system,BlinkMacSystemFont,sans-serif',
  'overflow:hidden',
].join(';');

const CAPTURE_STYLE = [
  'padding:8px 16px',
  'background:oklch(0.50 0.18 193)',
  'color:#fff',
  'border:none',
  'font-size:13px',
  'font-weight:500',
  'cursor:pointer',
  'line-height:20px',
  'transition:background-color 0.1s',
  '-webkit-font-smoothing:antialiased',
].join(';');

const OPEN_STYLE = [
  'padding:8px 14px',
  'background:oklch(0.13 0.003 193)',
  'color:oklch(0.83 0.14 193)',
  'border:none',
  'border-left:1px solid oklch(0.22 0.005 193)',
  'font-size:12px',
  'font-weight:500',
  'cursor:pointer',
  'line-height:20px',
  'white-space:nowrap',
  'transition:background-color 0.1s',
  '-webkit-font-smoothing:antialiased',
].join(';');

let captureBtn: HTMLButtonElement | null = null;
let openBtn: HTMLButtonElement | null = null;

function injectBar() {
  if (document.getElementById('spelflow-list-wrap')) return;

  const wrap = document.createElement('div');
  wrap.id = 'spelflow-list-wrap';
  wrap.style.cssText = BAR_STYLE;

  captureBtn = document.createElement('button');
  captureBtn.id = 'spelflow-list-capture-btn';
  captureBtn.textContent = 'Захватить новые';
  captureBtn.style.cssText = CAPTURE_STYLE;
  captureBtn.addEventListener('mouseenter', () => {
    if (!captureBtn!.disabled) captureBtn!.style.background = 'oklch(0.44 0.18 193)';
  });
  captureBtn.addEventListener('mouseleave', () => {
    if (!captureBtn!.disabled && !captureBtn!.dataset['done']) captureBtn!.style.background = 'oklch(0.50 0.18 193)';
  });
  captureBtn.addEventListener('click', () => void captureAll());

  openBtn = document.createElement('button');
  openBtn.id = 'spelflow-list-open-btn';
  openBtn.textContent = 'Открыть корзину →';
  openBtn.style.cssText = OPEN_STYLE + ';display:none';
  openBtn.addEventListener('mouseenter', () => { openBtn!.style.background = 'oklch(0.17 0.003 193)'; });
  openBtn.addEventListener('mouseleave', () => { openBtn!.style.background = 'oklch(0.13 0.003 193)'; });
  openBtn.addEventListener('click', async () => {
    const ws = await lastWorkspace.getValue();
    browser.runtime.sendMessage({ type: 'open-review-tab', workspaceUrl: ws?.url });
  });

  wrap.appendChild(captureBtn);
  wrap.appendChild(openBtn);
  document.body.appendChild(wrap);
}

async function refreshCount() {
  if (!captureBtn || captureBtn.dataset['busy']) return;

  const newRows = await getNewRows();
  if (newRows.length === 0) {
    captureBtn.textContent = 'Нет новых задач';
    captureBtn.disabled = true;
    captureBtn.style.background = 'oklch(0.30 0.01 193)';
  } else {
    captureBtn.textContent = `Захватить ${newRows.length} новых`;
    captureBtn.disabled = false;
    captureBtn.style.background = 'oklch(0.50 0.18 193)';
  }
}

async function captureAll() {
  if (!captureBtn || !openBtn || captureBtn.disabled || captureBtn.dataset['busy']) return;

  const newRows = await getNewRows();
  if (newRows.length === 0) {
    await refreshCount();
    return;
  }

  captureBtn.dataset['busy'] = '1';
  captureBtn.disabled = true;

  const captured: CapturedIssue[] = [];
  for (let i = 0; i < newRows.length; i++) {
    const row = newRows[i];
    if (!row) continue;
    captureBtn.textContent = `Захватываю ${i + 1}/${newRows.length}…`;

    let title = row.title;
    let body = '';
    try {
      const res = await fetch(row.url);
      if (res.ok) {
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const content = extractTaskContent(doc);
        if (content) {
          title = content.title;
          body = content.body;
        }
      }
    } catch {
      // Network hiccup on one task shouldn't abort the whole batch — fall
      // back to the title already visible in the list row, empty body.
    }

    captured.push({
      id: `gitverse-${row.taskId}-${Date.now()}-${i}`,
      provider: 'gitverse-tasktracker',
      externalId: row.taskId,
      externalUrl: row.url,
      title,
      body,
      labels: [],
      capturedAt: Date.now(),
    });
  }

  const basket = await reviewBasket.getValue();
  const existingUrls = new Set(basket.map((b) => b.externalUrl));
  const toAdd = captured.filter((c) => !existingUrls.has(c.externalUrl));
  await reviewBasket.setValue([...basket, ...toAdd]);

  captureBtn.textContent = `✓ Захвачено ${toAdd.length}`;
  captureBtn.style.background = 'oklch(0.44 0.18 193)';
  captureBtn.dataset['done'] = '1';
  openBtn.style.display = '';
  delete captureBtn.dataset['busy'];

  setTimeout(() => {
    if (captureBtn) delete captureBtn.dataset['done'];
    if (openBtn) openBtn.style.display = 'none';
    void refreshCount();
  }, 6000);
}

function observeMutations() {
  let debounce: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (!document.getElementById('spelflow-list-wrap')) injectBar();
    if (debounce) return;
    debounce = setTimeout(() => {
      debounce = null;
      void refreshCount();
    }, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
