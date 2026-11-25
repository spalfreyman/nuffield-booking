import { NextResponse } from 'next/server';
import { getLocation, getProduct, ready } from '@/lib/catalogue';
import { createShareCart, ordersEnabled } from '@/lib/orders';
import { shareToken } from '@/lib/share';
import { appointmentLabel } from '@/lib/appt';
import type { Audience } from '@/lib/types';
export const dynamic = 'force-dynamic';

// Merchant Center "Create booking link": makes a commercetools cart holding the chosen service, place and time,
// and returns a link a customer can open to finish the booking. CORS (middleware) restricts this to MC origins.
export async function POST(req: Request) {
  await ready();
  if (!ordersEnabled()) return NextResponse.json({ error: 'commercetools orders are disabled' }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as { loc?: string; sku?: string; startsAt?: string; audience?: Audience };
  const audience: Audience = b.audience && ['public', 'insurance', 'gym', 'business'].includes(b.audience) ? b.audience : 'public';
  const loc = b.loc ? getLocation(b.loc) : undefined;
  const product = b.sku ? getProduct(b.sku, audience, loc?.pricingRegion) : null;
  const start = b.startsAt ? new Date(b.startsAt) : null;
  if (!loc || !product || !start || isNaN(start.getTime())) return NextResponse.json({ error: 'invalid selection' }, { status: 400 });
  const startsAt = start.toISOString();
  const endsAt = new Date(start.getTime() + product.durationMins * 60000).toISOString();
  const cart = await createShareCart({ locationKey: loc.key, sku: product.sku, startsAt, endsAt, audience, format: loc.type === 'remote' ? 'remote' : 'in-person' });
  const url = `${new URL(req.url).origin}/s/${encodeURIComponent(await shareToken(cart.id))}`;
  return NextResponse.json({ cartId: cart.id, url, service: product.name, location: loc.name, when: appointmentLabel(startsAt, endsAt), audience });
}
