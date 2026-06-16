export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: { type: string }) => {
    if (message.type === 'open-review-tab') {
      browser.tabs.create({ url: 'https://app.spelflow.ru/extension/review' });
    }
  });
});
