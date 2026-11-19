import { NextResponse, type NextRequest } from 'next/server';

// CORS for the Merchant Center custom application calling /api/admin/*.
// In `mc-scripts start` the app runs inside https://mc.<region>.commercetools.com (a public https origin
// calling localhost), so that origin must be allowed as well as the dev server itself.
// Set ADMIN_ALLOWED_ORIGINS (comma separated) to add deployed app hosts.
const MC_ORIGIN = /^https:\/\/mc\.[a-z0-9-]+\.(?:[a-z0-9-]+\.)?commercetools\.com$/;
const extra = () => (process.env.ADMIN_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const isAllowed = (origin: string) => origin === 'http://localhost:3001' || MC_ORIGIN.test(origin) || extra().includes(origin);

export function middleware(req: NextRequest) {
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
export const config = { matcher: '/api/admin/:path*' };
