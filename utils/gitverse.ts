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

interface UnitV2Response {
  summary?: string;
  description?: string;
}

// The task detail page hydrates its content client-side after an XHR to this
// endpoint — a plain fetch() of the page HTML never contains the description,
// only the post-hydration DOM does. This same-origin JSON endpoint returns the
// task data directly (description already as markdown, no Turndown needed),
// so background bulk-capture can use it instead of fetching + parsing HTML.
export async function fetchTaskContent(taskId: string): Promise<GitverseTaskContent | null> {
  const res = await fetch(`https://gitverse.ru/swtr/rest/api/unit/v2/${taskId}`);
  if (!res.ok) return null;
  const data: UnitV2Response = await res.json();
  if (!data.summary) return null;
  return { title: data.summary, body: data.description ?? '' };
}
