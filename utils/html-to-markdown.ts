import TurndownService from 'turndown';

const td = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

export function htmlToMarkdown(html: string): string {
  return td.turndown(html);
}
