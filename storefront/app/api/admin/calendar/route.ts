import { NextResponse } from 'next/server';
import { ready } from '@/lib/catalogue';
import { gridForDay, summariseGrid, ymd } from '@/lib/calendar';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  await ready();
  const u = new URL(req.url).searchParams;
  const loc = u.get('loc') ?? '', sku = u.get('sku') ?? '';
  const days = Math.min(Number(u.get('days') ?? 7), 31);
  const [y, m, d] = (u.get('from') ?? ymd(new Date())).split('-').map(Number);
  const out = Array.from({ length: days }, (_, i) => {
    const date = ymd(new Date(Date.UTC(y, m - 1, d + i)));
    const cells = gridForDay(loc, sku, date);
    return { date, cells, ...summariseGrid(cells) };
  });
  return NextResponse.json({ days: out });
}
