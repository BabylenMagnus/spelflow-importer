import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { reviewBasket, lastWorkspace } from '../utils/storage';
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

const BTN_STYLE = [
  'position:fixed',
  'bottom:24px',
  'right:24px',
  'z-index:9999',
  'display:flex',
  'align-items:center',
  'gap:0',
  'border-radius:6px',
  'box-shadow:0 2px 12px oklch(0 0 0 / 0.35)',
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

function injectCaptureButton() {
  if (document.getElementById('spelflow-wrap')) return;

  const wrap = document.createElement('div');
  wrap.id = 'spelflow-wrap';
  wrap.style.cssText = BTN_STYLE;

  const captureBtn = document.createElement('button');
  captureBtn.id = 'spelflow-capture-btn';
  captureBtn.textContent = 'Capture to Spelflow';
  captureBtn.style.cssText = CAPTURE_STYLE;
  captureBtn.addEventListener('mouseenter', () => { captureBtn.style.background = 'oklch(0.44 0.18 193)'; });
  captureBtn.addEventListener('mouseleave', () => {
    if (!captureBtn.dataset['captured']) captureBtn.style.background = 'oklch(0.50 0.18 193)';
  });

  const openBtn = document.createElement('button');
  openBtn.id = 'spelflow-open-btn';
  openBtn.textContent = 'Открыть корзину →';
  openBtn.style.cssText = OPEN_STYLE + ';display:none';
  openBtn.addEventListener('mouseenter', () => { openBtn.style.background = 'oklch(0.17 0.003 193)'; });
  openBtn.addEventListener('mouseleave', () => { openBtn.style.background = 'oklch(0.13 0.003 193)'; });
  openBtn.addEventListener('click', async () => {
    const ws = await lastWorkspace.getValue();
    browser.runtime.sendMessage({ type: 'open-review-tab', workspaceUrl: ws?.url });
  });

  captureBtn.addEventListener('click', async () => {
    const issue = extractIssue();
    if (!issue) {
      showFeedback(captureBtn, 'Не удалось захватить', 'oklch(0.62 0.22 25)');
      return;
    }

    const basket = await reviewBasket.getValue();
    const alreadyIn = basket.some((i) => i.externalUrl === issue.externalUrl);

    if (alreadyIn) {
      showCaptured(captureBtn, openBtn, 'Уже в корзине');
      return;
    }

    await reviewBasket.setValue([...basket, issue]);
    showCaptured(captureBtn, openBtn, '✓ Захвачено');
  });

  wrap.appendChild(captureBtn);
  wrap.appendChild(openBtn);
  document.body.appendChild(wrap);
}

function showCaptured(captureBtn: HTMLButtonElement, openBtn: HTMLButtonElement, label: string) {
  captureBtn.textContent = label;
  captureBtn.style.background = 'oklch(0.44 0.18 193)';
  captureBtn.dataset['captured'] = '1';
  openBtn.style.display = '';

  setTimeout(() => {
    captureBtn.textContent = 'Capture to Spelflow';
    captureBtn.style.background = 'oklch(0.50 0.18 193)';
    delete captureBtn.dataset['captured'];
    openBtn.style.display = 'none';
  }, 5000);
}

function showFeedback(btn: HTMLButtonElement, text: string, color: string) {
  const prev = btn.textContent ?? '';
  const prevBg = btn.style.background;
  btn.textContent = text;
  btn.style.background = color;
  setTimeout(() => {
    btn.textContent = prev;
    btn.style.background = prevBg;
  }, 2000);
}
