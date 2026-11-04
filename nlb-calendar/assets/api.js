import { API_URL, MOCK } from './config.js?v=202611042019';

export class ApiError extends Error {
  constructor(message, { network = false, status = 0, clash = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.network = network; // true = no signal or timeout, so a retry makes sense
    this.status = status;
    this.clash = clash;     // true = the time overlaps something; sending the same request again with force: true saves it anyway
  }
}

/* POST /exec with a text/plain JSON body (no preflight), following the Apps Script redirect. */
export async function api(action, params = {}, { timeout = 30000 } = {}) {
  if (MOCK) {
    const m = await import('./mock.js?v=202611042019');
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
    throw new ApiError(e && e.name === 'AbortError' ? 'That took too long. Check your signal and try again.' : 'No signal. Could not reach the server.', { network: true });
  } finally {
    clearTimeout(timer);
  }
  let data;
  try { data = await res.json(); } catch (e) {
    throw new ApiError(res.ok ? 'Unexpected reply from the server.' : 'The server is not available right now.', { network: !res.ok, status: res.status });
  }
  if (!data || data.ok !== true) throw new ApiError((data && data.error) || 'Something went wrong.', { status: res.status, clash: !!(data && data.clash) });
  return data;
}

export const errMsg = e => (e && e.message) || 'Something went wrong.';
