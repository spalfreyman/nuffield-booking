import { NextResponse } from 'next/server';
import { allLocations, getProduct, locationOffers, ready } from '@/lib/catalogue';
import { gridForDay, summariseGrid, ymd } from '@/lib/calendar';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  await ready();
  const u = new URL(req.url).searchParams;
  const sku = u.get('sku') ?? '';
  const days = Math.min(Number(u.get('days') ?? 14), 31);
  const product = getProduct(sku, 'public');
  if (!product) return NextResponse.json({ error: 'unknown_sku' }, { status: 404 });
  const [y, m, d] = (u.get('from') ?? ymd(new Date())).split('-').map(Number);
  const dates = Array.from({ length: days }, (_, i) => ymd(new Date(Date.UTC(y, m - 1, d + i))));
  const rows = allLocations().filter((l) => locationOffers(l, product)).map((l) => ({
    key: l.key, name: l.name, type: l.type, town: l.town,
    days: dates.map((date) => ({ date, ...summariseGrid(gridForDay(l.key, sku, date)) })),
  }));
  return NextResponse.json({ dates, rows });
}
