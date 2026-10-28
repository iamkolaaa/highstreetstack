import { API_URL, MOCK } from './config.js';

export class ApiError extends Error {
  constructor(message, { network = false, status = 0 } = {}) {
    super(message);
    this.name = 'ApiError';
    this.network = network; // true = no signal / timeout: safe to retry later
    this.status = status;
  }
}

export async function api(action, params = {}, { timeout = 30000 } = {}) {
  if (MOCK) {
    const m = await import('./mock.js');
    return m.handle(action, params);
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...params }),
      signal: ctl.signal,
      redirect: 'follow'
    });
  } catch (e) {
    throw new ApiError(e && e.name === 'AbortError' ? 'The request timed out. Check your signal and try again.' : 'No signal. Could not reach the server.', { network: true });
  } finally {
    clearTimeout(timer);
  }
  let data;
  try { data = await res.json(); } catch (e) {
    throw new ApiError(res.ok ? 'Unexpected reply from the server.' : 'The server is not available right now.', { network: !res.ok, status: res.status });
  }
  if (!data || data.ok !== true) throw new ApiError((data && data.error) || 'Something went wrong.', { status: res.status });
  return data;
}

export const errMsg = e => (e && e.message) || 'Something went wrong.';
