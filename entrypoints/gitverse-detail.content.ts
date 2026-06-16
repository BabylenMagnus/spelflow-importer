import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { reviewBasket, lastWorkspace } from '../utils/storage';
import type { CapturedIssue } from '../utils/types';

export default defineContentScript({
  matches: ['*://gitverse.ru/*/*/tasktracker/*'],
  async main(_ctx: ContentScriptContext) {
    if (!isTaskPage()) return;

    waitForHydration(() => {
      injectCaptureButton();
      keepButtonAlive();
    });

    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      document.getElementById('spelflow-wrap')?.remove();
      if (isTaskPage()) {
        waitForHydration(() => {
          injectCaptureButton();
          keepButtonAlive();
        });
      }
    }).observe(document.body, { childList: true, subtree: true });
  },
});

function waitForHydration(cb: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => { observer.disconnect(); cb(); }, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  timer = setTimeout(() => { observer.disconnect(); cb(); }, 300);
}

function keepButtonAlive() {
  let debounce: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (document.getElementById('spelflow-wrap')) return;
    if (!isTaskPage()) return;
    if (debounce) return;
    debounce = setTimeout(() => {
      debounce = null;
      if (!document.getElementById('spelflow-wrap') && isTaskPage()) {
        injectCaptureButton();
      }
    }, 200);
  });
  observer.observe(document.body, { childList: true });
}

function isTaskPage(): boolean {
  return /\/tasktracker\/[A-Z][A-Z0-9]+-\d+/.test(location.pathname);
}

function extractIssue(): CapturedIssue | null {
  const titleEl = document.querySelector<HTMLElement>('h3.text-h3');
  const title = titleEl?.textContent?.trim();
  if (!title) return null;

  const taskId = location.pathname.split('/').pop();
  if (!taskId || !/^[A-Z][A-Z0-9]+-\d+$/.test(taskId)) return null;

  const mainEl = document.querySelector('main');
  const body = mainEl
    ? Array.from(mainEl.querySelectorAll<HTMLElement>('p, li'))
        .map((el) => el.textContent?.trim())
        .filter((t) => t && t.length > 0)
        .slice(0, 20)
        .join('\n')
    : '';

  return {
    id: `gitverse-${taskId}-${Date.now()}`,
    provider: 'gitverse',
    externalId: taskId,
    externalUrl: location.href,
    title,
    body,
    labels: [],
    capturedAt: Date.now(),
  };
}

const BTN_STYLE = [
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
