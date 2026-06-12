import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { reviewBasket } from '../utils/storage';
import type { CapturedIssue } from '../utils/types';

export default defineContentScript({
  matches: ['*://github.com/*/*/issues/*', '*://github.com/*/*/pull/*'],
  async main(_ctx: ContentScriptContext) {
    if (!isIssuePage()) return;
    injectCaptureButton();
  },
});

function isIssuePage(): boolean {
  return /\/(issues|pull)\/\d+/.test(location.pathname);
}

function extractIssue(): CapturedIssue | null {
  const titleEl = document.querySelector<HTMLElement>('.js-issue-title, h1.gh-header-title .js-issue-title');
  const title = titleEl?.textContent?.trim();
  if (!title) return null;

  const pathParts = location.pathname.split('/');
  // /owner/repo/issues/123
  const numberStr = pathParts[4];
  if (!numberStr) return null;
  const issueNumber = parseInt(numberStr, 10);
  if (isNaN(issueNumber)) return null;

  const bodyEl = document.querySelector<HTMLElement>('.js-comment-body, .comment-body');
  const body = bodyEl?.innerText?.trim() ?? '';

  const labelEls = document.querySelectorAll<HTMLElement>('.js-issue-labels .IssueLabel, a[data-hovercard-type="label"]');
  const labels = Array.from(labelEls).map((el) => el.textContent?.trim() ?? '').filter(Boolean);

  return {
    id: `github-${issueNumber}-${Date.now()}`,
    provider: 'github',
    externalId: `#${issueNumber}`,
    externalUrl: location.href,
    title,
    body,
    labels,
    capturedAt: Date.now(),
  };
}

function injectCaptureButton() {
  if (document.getElementById('spelflow-capture-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'spelflow-capture-btn';
  btn.textContent = 'Capture to Spelflow';
  btn.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'right:24px',
    'z-index:9999',
    'padding:8px 16px',
    'background:#2da44e',
    'color:#fff',
    'border:none',
    'border-radius:6px',
    'font-size:14px',
    'font-weight:600',
    'cursor:pointer',
    'box-shadow:0 2px 8px rgba(0,0,0,0.2)',
  ].join(';');

  btn.addEventListener('click', async () => {
    const issue = extractIssue();
    if (!issue) {
      btn.textContent = 'Could not capture';
      setTimeout(() => (btn.textContent = 'Capture to Spelflow'), 2000);
      return;
    }

    const basket = await reviewBasket.getValue();
    const alreadyIn = basket.some((i) => i.externalUrl === issue.externalUrl);
    if (alreadyIn) {
      btn.textContent = 'Already in basket';
      setTimeout(() => (btn.textContent = 'Capture to Spelflow'), 2000);
      return;
    }

    await reviewBasket.setValue([...basket, issue]);
    btn.textContent = 'Captured!';
    setTimeout(() => (btn.textContent = 'Capture to Spelflow'), 2000);
  });

  document.body.appendChild(btn);
}
