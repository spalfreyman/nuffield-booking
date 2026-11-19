import { NextResponse } from 'next/server';
import { allBookings } from '@/lib/calendar';
export const dynamic = 'force-dynamic';
// No patient data is returned: reference, slot and commercetools order id only.
export function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const loc = u.get('loc'), sku = u.get('sku');
  const bookings = allBookings()
    .filter((b) => (!loc || b.locationKey === loc) && (!sku || b.sku === sku))
    .map((b) => ({ reference: b.reference, sku: b.sku, locationKey: b.locationKey, startsAt: b.startsAt, audience: b.audience, price: b.price, status: b.status, orderId: b.orderId ?? null }));
  return NextResponse.json({ bookings });
}
