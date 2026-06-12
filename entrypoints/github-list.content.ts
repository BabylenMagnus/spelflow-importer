import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { reviewBasket } from '../utils/storage';
import type { CapturedIssue } from '../utils/types';

export default defineContentScript({
  matches: ['*://github.com/*/*/issues', '*://github.com/*/*/issues?*'],
  async main(_ctx: ContentScriptContext) {
    injectListButtons();
    observeMutations();
  },
});

function extractIssueFromRow(row: Element): CapturedIssue | null {
  const linkEl = row.querySelector<HTMLAnchorElement>('a[data-hovercard-type="issue"], a[id^="issue_"]');
  if (!linkEl) return null;

  const href = linkEl.href;
  const match = href.match(/\/issues\/(\d+)/);
  if (!match) return null;
  const issueNumber = match[1];

  const title = linkEl.textContent?.trim();
  if (!title) return null;

  const labelEls = row.querySelectorAll<HTMLElement>('a[data-hovercard-type="label"]');
  const labels = Array.from(labelEls).map((el) => el.textContent?.trim() ?? '').filter(Boolean);

  return {
    id: `github-${issueNumber}-${Date.now()}`,
    provider: 'github',
    externalId: `#${issueNumber}`,
    externalUrl: href,
    title,
    body: '',
    labels,
    capturedAt: Date.now(),
  };
}

function injectListButtons() {
  const rows = document.querySelectorAll<HTMLElement>('[data-id] .js-navigation-item, li[id^="issue_"]');
  rows.forEach((row) => {
    if (row.querySelector('.spelflow-row-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'spelflow-row-btn';
    btn.textContent = '+';
    btn.title = 'Capture to Spelflow';
    btn.style.cssText = [
      'margin-left:8px',
      'padding:2px 8px',
      'background:#2da44e',
      'color:#fff',
      'border:none',
      'border-radius:4px',
      'font-size:12px',
      'font-weight:600',
      'cursor:pointer',
      'vertical-align:middle',
    ].join(';');

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const issue = extractIssueFromRow(row);
      if (!issue) return;

      const basket = await reviewBasket.getValue();
      const alreadyIn = basket.some((i) => i.externalUrl === issue.externalUrl);
      if (alreadyIn) {
        btn.textContent = '✓';
        return;
      }

      await reviewBasket.setValue([...basket, issue]);
      btn.textContent = '✓';
    });

    const actionsArea = row.querySelector('.float-right, .issue-meta-section') ?? row;
    actionsArea.appendChild(btn);
  });
}

function observeMutations() {
  const target = document.querySelector('#js-issues-toolbar')?.parentElement ?? document.body;
  const observer = new MutationObserver(() => injectListButtons());
  observer.observe(target, { childList: true, subtree: true });
}
