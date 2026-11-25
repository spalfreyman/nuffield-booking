import { NextResponse } from 'next/server';
import { confirmBooking, getBooking } from '@/lib/calendar';
import { getLocation, getProduct, ready } from '@/lib/catalogue';
import { createOrder, ordersEnabled } from '@/lib/orders';
import type { Audience } from '@/lib/types';
import { relevantFunding } from '@/lib/funding';
export const dynamic = 'force-dynamic';

// Stand-in for: create commercetools cart (customerGroup, line item w/ slot custom fields) -> order.
// Card details are never sent: the client sends only a mock payment token.
export async function POST(req: Request) {
  await ready();
  const b = await req.json();
  const audience = b.audience as Audience;
  const loc = getLocation(b.locationKey);
  const product = getProduct(b.sku, audience, loc?.pricingRegion);
  if (!loc || !product) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const needsCard = audience !== 'business';
  if (needsCard && !b.paymentToken) return NextResponse.json({ error: 'payment_required' }, { status: 400 });
  const res = confirmBooking({
    holdId: b.holdId, sku: b.sku, locationKey: loc.key, startsAt: b.startsAt, audience, price: product.price,
    patient: b.patient ?? {}, funding: relevantFunding(audience, b.funding), paymentToken: b.paymentToken ?? null,
  });
  if ('error' in res) return NextResponse.json(res, { status: 410 });
  let order: { orderId: string; orderNumber: string; total: number } | null = null;
  if (ordersEnabled()) {
    try {
      const endsAt = new Date(new Date(b.startsAt).getTime() + product.durationMins * 60000).toISOString();
      order = await createOrder(res.booking, endsAt, loc.type === 'remote' ? 'remote' : 'in-person', typeof b.cartId === 'string' ? b.cartId : undefined);
      res.booking.orderId = order.orderId;
    } catch (e) {
      // The slot is already confirmed in the calendar; surface the problem instead of losing the booking.
      res.booking.orderError = (e as Error).message;
      console.error('[bookings] commercetools order failed:', (e as Error).message);
    }
  }
  return NextResponse.json({ booking: res.booking, product, location: loc, order });
}
export async function GET(req: Request) {
  await ready();
  const ref = new URL(req.url).searchParams.get('ref') ?? '';
  const booking = getBooking(ref);
  return booking ? NextResponse.json({ booking }) : NextResponse.json({ error: 'not_found' }, { status: 404 });
}
