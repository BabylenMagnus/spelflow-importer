import './style.css';
import { authToken, connectedAccount, reviewBasket, lastWorkspace } from '../../utils/storage';
import { connectToSpelflow, disconnectFromSpelflow } from '../../utils/auth';

function show(id: string) {
  ['state-connected', 'state-disconnected', 'state-loading', 'state-error'].forEach((s) => {
    document.getElementById(s)?.classList.toggle('hidden', s !== id);
  });
}

async function render() {
  const token = await authToken.getValue();
  const account = await connectedAccount.getValue();
  const basket = await reviewBasket.getValue();

  if (token && account) {
    show('state-connected');
    document.getElementById('account-name')!.textContent = account.name;
    const count = basket.length;
    document.getElementById('basket-count')!.textContent =
      count > 0 ? `${count} issue${count > 1 ? 's' : ''} in basket` : 'Basket is empty';
  } else {
    show('state-disconnected');
  }
}

document.getElementById('btn-connect')?.addEventListener('click', async () => {
  show('state-loading');
  try {
    await connectToSpelflow();
    await render();
  } catch (err) {
    show('state-error');
    document.getElementById('error-message')!.textContent =
      err instanceof Error ? err.message : 'Connection failed';
  }
});

document.getElementById('btn-retry')?.addEventListener('click', () => render());

document.getElementById('btn-disconnect')?.addEventListener('click', async () => {
  await disconnectFromSpelflow();
  await render();
});

document.getElementById('btn-open-review')?.addEventListener('click', async () => {
  const ws = await lastWorkspace.getValue();
  browser.runtime.sendMessage({ type: 'open-review-tab', workspaceUrl: ws?.url });
  window.close();
});

render();
authToken.watch(() => render());
reviewBasket.watch(() => render());
