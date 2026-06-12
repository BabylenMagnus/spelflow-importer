import { authToken, connectedAccount } from './storage';

const SPELFLOW_CONNECT_URL = 'https://spelflow.ru/extension/connect';

export async function connectToSpelflow(): Promise<void> {
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = `${SPELFLOW_CONNECT_URL}?redirect_uri=${encodeURIComponent(redirectUri)}`;

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });

  if (!responseUrl) throw new Error('Auth cancelled');

  const fragment = new URL(responseUrl).hash;
  const params = new URLSearchParams(fragment.slice(1));
  const token = params.get('token');
  if (!token) throw new Error('No token in response');

  await authToken.setValue(token);

  // Fetch account info to display in popup
  const res = await fetch('https://spelflow.ru/account/api/v1/workspaces', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    // Account info comes from the JWT itself — decode name from payload
    const [, payload] = token.split('.');
    try {
      const decoded = JSON.parse(atob(payload));
      await connectedAccount.setValue({
        name: decoded.name ?? decoded.email ?? 'Spelflow User',
        email: decoded.email ?? '',
      });
    } catch {
      await connectedAccount.setValue({ name: 'Spelflow User', email: '' });
    }
  }
}

export async function disconnectFromSpelflow(): Promise<void> {
  const token = await authToken.getValue();
  if (token) {
    try {
      await fetch('https://spelflow.ru/account/api/v1/extension/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore network errors on disconnect
    }
  }
  await authToken.setValue(null);
  await connectedAccount.setValue(null);
}

export async function getAuthToken(): Promise<string | null> {
  return authToken.getValue();
}
