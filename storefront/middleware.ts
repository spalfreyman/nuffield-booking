import { NextResponse, type NextRequest } from 'next/server';

// CORS for the Merchant Center custom application calling /api/admin/*.
// In `mc-scripts start` the app runs inside https://mc.<region>.commercetools.com (a public https origin
// calling localhost), so that origin must be allowed as well as the dev server itself.
// Set ADMIN_ALLOWED_ORIGINS (comma separated) to add deployed app hosts.
const MC_ORIGIN = /^https:\/\/mc\.[a-z0-9-]+\.(?:[a-z0-9-]+\.)?commercetools\.com$/;
const extra = () => (process.env.ADMIN_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const isAllowed = (origin: string) => origin === 'http://localhost:3001' || MC_ORIGIN.test(origin) || extra().includes(origin);

// Password gate (HTTP Basic, any username) for the storefront pages and its own APIs.
// Enabled only when STOREFRONT_PASSWORD is set, so local dev stays open.
// /api/admin/* is excluded on purpose: the Merchant Center app calls it cross-origin and cannot send these credentials.
function gate(req: NextRequest): NextResponse | null {
  const password = process.env.STOREFRONT_PASSWORD;
  if (!password) return null;
  const header = req.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    try {
      const given = atob(header.slice(6)).split(':').slice(1).join(':');
      let diff = given.length ^ password.length;
      for (let i = 0; i < Math.max(given.length, password.length); i++) diff |= (given.charCodeAt(i) || 0) ^ (password.charCodeAt(i) || 0);
      if (diff === 0) return null;
    } catch {
      /* fall through to 401 */
    }
  }
  return new NextResponse('Password required', { status: 401, headers: { 'www-authenticate': 'Basic realm="Nuffield booking", charset="UTF-8"' } });
}

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api/admin/')) return gate(req) ?? NextResponse.next();
  const origin = req.headers.get('origin') ?? '';
  const ok = isAllowed(origin);
  const headers: Record<string, string> = ok
    ? {
        'access-control-allow-origin': origin,
        vary: 'origin',
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'GET,OPTIONS',
        // Chrome's Private/Local Network Access: public page -> localhost preflight.
        'access-control-allow-private-network': 'true',
      }
    : {};
  if (req.method === 'OPTIONS') return new NextResponse(null, { status: ok ? 204 : 403, headers });
  const res = NextResponse.next();
  Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
