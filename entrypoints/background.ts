export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: { type: string }) => {
    if (message.type === 'open-review-tab') {
      browser.tabs.create({ url: browser.runtime.getURL('/review-tab.html') });
    }
  });
});
