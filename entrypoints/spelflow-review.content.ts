import { reviewBasket, authToken, lastWorkspace, lastProject } from '../utils/storage';
import { getWorkspaces, getProjects, createIssue } from '../utils/spelflow-api';
import type { CapturedIssue } from '../utils/types';

export default defineContentScript({
  matches: ['*://app.spelflow.ru/*'],
  runAt: 'document_end',
  async main() {
    function send(msg: Record<string, unknown>) {
      window.postMessage({ source: 'spelflow-ext', ...msg }, '*');
    }

    async function init() {
      const token = await authToken.getValue();
      if (!token) {
        send({ type: 'SF_NOT_CONNECTED' });
        return;
      }

      const basket = await reviewBasket.getValue();
      send({ type: 'SF_BASKET_DATA', basket });

      try {
        const wsList = await getWorkspaces();
        send({ type: 'SF_WORKSPACES', workspaces: wsList });

        const saved = await lastWorkspace.getValue();
        const firstWs = saved ?? wsList[0];
        if (firstWs) {
          if (!saved) await lastWorkspace.setValue(firstWs);
          const pjList = await getProjects(firstWs.url);
          send({ type: 'SF_PROJECTS', projects: pjList });
        }
      } catch {
        send({ type: 'SF_WORKSPACES_ERROR' });
      }
    }

    window.addEventListener('message', async (e) => {
      if (e.data?.source !== 'spelflow-page') return;
      const d = e.data;

      if (d.type === 'SF_INIT') {
        await init();
      }

      if (d.type === 'SF_GET_PROJECTS') {
        try {
          const pjList = await getProjects(d.workspaceUrl as string);
          send({ type: 'SF_PROJECTS', projects: pjList });
          const ws = (await getWorkspaces()).find((w) => w.url === d.workspaceUrl);
          if (ws) await lastWorkspace.setValue(ws);
        } catch {
          send({ type: 'SF_PROJECTS', projects: [] });
        }
      }

      if (d.type === 'SF_IMPORT') {
        const issue = d.issue as CapturedIssue;
        const workspace = d.workspace as string;
        const project = d.project as string;
        const index = d.index as number;
        try {
          const result = await createIssue(workspace, project, issue);
          const wsList = await getWorkspaces();
          const ws = wsList.find((w) => w.url === workspace);
          const spelflowUrl = ws
            ? `https://app.spelflow.ru/workbench/${workspace}/tracker/${result.identifier}`
            : undefined;
          send({ type: 'SF_IMPORT_RESULT', index, ok: true, spelflowUrl });

          const basket = await reviewBasket.getValue();
          await reviewBasket.setValue(basket.filter((i) => i.externalUrl !== issue.externalUrl));

          const savedPj = (await getProjects(workspace)).find((p) => p.identifier === project);
          if (savedPj) await lastProject.setValue(savedPj);
        } catch (err) {
          send({
            type: 'SF_IMPORT_RESULT',
            index,
            ok: false,
            error: err instanceof Error ? err.message : 'Import failed',
          });
        }
      }

      if (d.type === 'SF_RETRY_WORKSPACES') {
        try {
          const wsList = await getWorkspaces();
          send({ type: 'SF_WORKSPACES', workspaces: wsList });
          const saved = await lastWorkspace.getValue();
          const firstWs = saved ?? wsList[0];
          if (firstWs) {
            if (!saved) await lastWorkspace.setValue(firstWs);
            const pjList = await getProjects(firstWs.url);
            send({ type: 'SF_PROJECTS', projects: pjList });
          }
        } catch {
          send({ type: 'SF_WORKSPACES_ERROR' });
        }
      }

      if (d.type === 'SF_CLEAR_BASKET') {
        await reviewBasket.setValue([]);
      }

      if (d.type === 'SF_REMOVE_IDX') {
        const basket = await reviewBasket.getValue();
        basket.splice(d.index as number, 1);
        await reviewBasket.setValue([...basket]);
      }
    });

    // Watch for basket additions from other tabs (e.g. GitHub capture)
    reviewBasket.watch((newBasket) => {
      send({ type: 'SF_BASKET_UPDATED', basket: newBasket });
    });
  },
});
