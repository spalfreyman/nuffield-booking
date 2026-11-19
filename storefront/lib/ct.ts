// Minimal commercetools HTTP client (server-side only; credentials come from process.env).
// Uses the *frontend* API client (view_products, manage_orders...). Never import from client components.
const cfg = () => ({
  project: process.env.CTP_PROJECT_KEY, api: process.env.CTP_API_URL, auth: process.env.CTP_AUTH_URL,
  id: process.env.CTP_CLIENT_ID, secret: process.env.CTP_CLIENT_SECRET,
});

export const ctConfigured = () => { const c = cfg(); return !!(c.project && c.api && c.auth && c.id && c.secret); };

let tok: { v: string; exp: number } | null = null;
async function token(force = false) {
  if (!force && tok && tok.exp > Date.now() + 30_000) return tok.v;
  const c = cfg();
  const r = await withNetRetry(() => fetch(c.auth!.replace(/\/$/, '') + '/oauth/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${c.id}:${c.secret}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials', cache: 'no-store',
  }));
  if (!r.ok) throw new Error(`commercetools auth failed (${r.status})`);
  const j = await r.json();
  tok = { v: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return tok.v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withNetRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 2 || !(e instanceof TypeError)) throw e; // TypeError = network-level fetch failure
      await sleep(300 * (i + 1));
    }
  }
}

export async function ct<T = any>(method: 'GET' | 'POST', path: string, body?: unknown, retry = true): Promise<T> {
  const c = cfg();
  const r = await withNetRetry(async () => fetch(`${c.api}/${c.project}${path}`, {
    method, cache: 'no-store',
    headers: { Authorization: `Bearer ${await token()}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }));
  if (r.status === 401 && retry) { await token(true); return ct(method, path, body, false); }
  const text = await r.text();
  const json = text ? JSON.parse(text) : null;
  if (!r.ok) throw Object.assign(new Error(`commercetools ${method} ${path.split('?')[0]} -> ${r.status}: ${json?.message ?? ''}`), { status: r.status, body: json });
  return json;
}

/** Page through a list endpoint. */
export async function ctAll<T = any>(path: string): Promise<T[]> {
  const out: T[] = [];
  const sep = path.includes('?') ? '&' : '?';
  for (let offset = 0; ; offset += 500) {
    const page = await ct<{ results: T[]; total: number }>('GET', `${path}${sep}limit=500&offset=${offset}&withTotal=true`);
    out.push(...page.results);
    if (out.length >= page.total || !page.results.length) return out;
  }
}
