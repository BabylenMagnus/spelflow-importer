import { storage } from 'wxt/utils/storage';
import type { CapturedIssue, SpelflowWorkspace, SpelflowProject } from './types';

export const authToken = storage.defineItem<string | null>('local:authToken', {
  defaultValue: null,
});

export const connectedAccount = storage.defineItem<{ name: string; email: string } | null>(
  'local:connectedAccount',
  { defaultValue: null }
);

export const reviewBasket = storage.defineItem<CapturedIssue[]>('local:reviewBasket', {
  defaultValue: [],
});

export const lastWorkspace = storage.defineItem<SpelflowWorkspace | null>('local:lastWorkspace', {
  defaultValue: null,
});

export const lastProject = storage.defineItem<SpelflowProject | null>('local:lastProject', {
  defaultValue: null,
});
