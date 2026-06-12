export interface CapturedIssue {
  id: string;
  provider: 'github' | 'gitverse-issues' | 'gitverse-tasktracker';
  externalId: string;
  externalUrl: string;
  title: string;
  body: string;
  labels: string[];
  capturedAt: number;
}

export interface SpelflowWorkspace {
  id: string;
  url: string;
  name: string;
}

export interface SpelflowProject {
  id: string;
  name: string;
  identifier: string;
}

export type ImportStatus = 'pending' | 'importing' | 'done' | 'error';

export interface ImportResult {
  issueId: string;
  status: ImportStatus;
  spelflowTaskUrl?: string;
  errorMessage?: string;
}
