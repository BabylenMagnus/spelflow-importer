export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: { type: string; workspaceUrl?: string }) => {
    if (message.type === 'open-review-tab') {
      const url = message.workspaceUrl
        ? `https://app.spelflow.ru/workbench/${message.workspaceUrl}/extension`
        : 'https://app.spelflow.ru';
      browser.tabs.create({ url });
    }
  });
});
