import { htmlToMarkdown } from './html-to-markdown';

export interface GitverseTaskContent {
  title: string;
  body: string;
}

const TASK_ID_RE = /\/tasktracker\/([A-Z][A-Z0-9]+-\d+)(?:[/?#]|$)/;

export function parseTaskIdFromUrl(url: string): string | null {
  const match = url.match(TASK_ID_RE);
  return match?.[1] ?? null;
}

// Gitverse renders the task description as a CSS-module class containing
// "editorContent" (e.g. text-editor-preview_editorContent__7DXuu) — the hash
// suffix is build-specific, so match on the stable substring instead of the
// full class name.
export function extractTaskContent(doc: ParentNode): GitverseTaskContent | null {
  const titleEl = doc.querySelector<HTMLElement>('h3.text-h3');
  const title = titleEl?.textContent?.trim();
  if (!title) return null;

  const bodyEl = doc.querySelector<HTMLElement>('[class*="editorContent"]');
  const body = bodyEl ? htmlToMarkdown(bodyEl.innerHTML) : '';

  return { title, body };
}
