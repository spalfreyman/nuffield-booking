import { NextResponse } from 'next/server';
import { allLocations, getProduct, haversineMiles, locationOffers, REMOTE_LOCATION, ready } from '@/lib/catalogue';
import { firstAvailable, ymd } from '@/lib/calendar';
import type { Audience, Clinic } from '@/lib/types';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  await ready();
  const u = new URL(req.url).searchParams;
  const sku = u.get('sku') ?? '';
  const audience = (u.get('audience') as Audience) ?? 'public';
  const product = getProduct(sku, audience);
  if (!product) return NextResponse.json({ error: 'unknown_sku' }, { status: 404 });
  const from = u.get('from') ?? ymd(new Date());
  if (u.get('format') === 'remote') {
    const clinic: Clinic = { ...REMOTE_LOCATION, distanceMiles: 0, firstAvailable: firstAvailable(REMOTE_LOCATION.key, sku, from) };
    return NextResponse.json({ clinics: [clinic] });
  }
  const origin = { lat: Number(u.get('lat')), lng: Number(u.get('lng')) };
  const clinics: Clinic[] = allLocations()
    .filter((l) => locationOffers(l, product))
    .map((l) => ({ ...l, distanceMiles: haversineMiles(origin, l), firstAvailable: null as string | null }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, 8)
    .map((c) => ({ ...c, distanceMiles: Math.round(c.distanceMiles * 10) / 10, firstAvailable: firstAvailable(c.key, sku, from) }));
  return NextResponse.json({ clinics });
}
