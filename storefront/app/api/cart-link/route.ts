import { NextResponse } from 'next/server';
import { ct } from '@/lib/ct';
import { FAMILIES, getLocation, getProduct, ready } from '@/lib/catalogue';
import { slotsForDay } from '@/lib/calendar';
import type { Audience } from '@/lib/types';
export const dynamic = 'force-dynamic';

// Reads a booking-link cart so the booking flow can pre-fill the selection.
export async function GET(req: Request) {
  await ready();
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const cart = id ? await ct('GET', `/carts/${id}`).catch(() => null) : null;
  if (!cart || cart.custom?.fields?.source !== 'merchant-center-link') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (cart.cartState !== 'Active') return NextResponse.json({ error: 'already_booked' }, { status: 410 });
  const li = cart.lineItems?.[0];
  const audience = (cart.custom.fields.audience ?? 'public') as Audience;
  const channel = li?.distributionChannel?.id ? await ct('GET', `/channels/${li.distributionChannel.id}`).catch(() => null) : null;
  const loc = getLocation(channel?.key ?? '');
  const sku = li?.variant?.sku as string | undefined;
  const product = sku ? getProduct(sku, audience, loc?.pricingRegion) : null;
  const startsAt = li?.custom?.fields?.startsAt as string | undefined;
  if (!loc || !product || !startsAt) return NextResponse.json({ error: 'invalid_cart' }, { status: 422 });
  const date = startsAt.slice(0, 10);
  const slot = slotsForDay(loc.key, product.sku, date).find((s) => s.startsAt === startsAt) ?? null;
  const family = FAMILIES.find((f) => f.key === product.family) ?? null;
  return NextResponse.json({ cartId: id, audience, product, family, location: loc, startsAt, slot });
}
