import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { reviewBasket } from '../utils/storage';
import type { CapturedIssue } from '../utils/types';

export default defineContentScript({
  matches: ['*://gitverse.ru/*/*/tasktracker/*'],
  async main(_ctx: ContentScriptContext) {
    if (!isTaskPage()) return;

    // Wait for React to finish hydration before injecting.
    // Hydration removes any DOM nodes we add during document_end.
    waitForHydration(() => {
      injectCaptureButton();
      keepButtonAlive();
    });

    // Handle SPA navigation between tasks
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      document.getElementById('spelflow-capture-btn')?.remove();
      if (isTaskPage()) {
        waitForHydration(() => {
          injectCaptureButton();
          keepButtonAlive();
        });
      }
    }).observe(document.body, { childList: true, subtree: true });
  },
});

// Wait until Next.js finishes hydrating the page.
// We detect this by watching for the <body> to stop changing rapidly.
function waitForHydration(cb: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    // Re-start 300ms quiet period timer on every DOM change
    timer = setTimeout(() => {
      observer.disconnect();
      cb();
    }, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  // Kick off with an initial 300ms delay in case page is already stable
  timer = setTimeout(() => {
    observer.disconnect();
    cb();
  }, 300);
}

// If React removes our button (e.g. partial re-render), put it back.
function keepButtonAlive() {
  let debounce: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (document.getElementById('spelflow-capture-btn')) return;
    if (!isTaskPage()) return;
    if (debounce) return;
    debounce = setTimeout(() => {
      debounce = null;
      if (!document.getElementById('spelflow-capture-btn') && isTaskPage()) {
        injectCaptureButton();
      }
    }, 200);
  });
  // Only watch direct children of body — that's where our button lives
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

function injectCaptureButton() {
  if (document.getElementById('spelflow-capture-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'spelflow-capture-btn';
  btn.textContent = 'Capture to Spelflow';
  btn.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'right:24px',
    'z-index:2147483647',
    'padding:8px 16px',
    'background:#2da44e',
    'color:#fff',
    'border:none',
    'border-radius:6px',
    'font-size:14px',
    'font-weight:600',
    'cursor:pointer',
    'box-shadow:0 2px 8px rgba(0,0,0,0.25)',
    'font-family:system-ui,sans-serif',
  ].join(';');

  btn.addEventListener('mouseenter', () => { btn.style.background = '#2c974b'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = '#2da44e'; });

  btn.addEventListener('click', async () => {
    const issue = extractIssue();
    if (!issue) {
      btn.textContent = 'Could not capture';
      setTimeout(() => (btn.textContent = 'Capture to Spelflow'), 2000);
      return;
    }
    const basket = await reviewBasket.getValue();
    if (basket.some((i) => i.externalUrl === issue.externalUrl)) {
      btn.textContent = 'Already in basket';
      setTimeout(() => (btn.textContent = 'Capture to Spelflow'), 2000);
      return;
    }
    await reviewBasket.setValue([...basket, issue]);
    btn.textContent = '✓ Captured!';
    btn.style.background = '#1a7f37';
    setTimeout(() => {
      btn.textContent = 'Capture to Spelflow';
      btn.style.background = '#2da44e';
    }, 2000);
  });

  document.body.appendChild(btn);
}
