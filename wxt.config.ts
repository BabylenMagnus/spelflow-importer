import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Spelflow Importer',
    description: 'Capture issues from GitHub and GitVerse into Spelflow',
    permissions: ['storage', 'tabs', 'identity'],
    host_permissions: [
      '*://github.com/*',
      '*://gitverse.ru/*',
      'https://spelflow.ru/*',
    ],
    action: {},
  },
});
