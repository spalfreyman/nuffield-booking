import { ready } from '@/lib/catalogue';
import { NextResponse } from 'next/server';
import { availability, ymd } from '@/lib/calendar';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  await ready();
  const u = new URL(req.url).searchParams;
  const days = Math.min(Number(u.get('days') ?? 28), 60);
  return NextResponse.json({ days: availability(u.get('loc') ?? '', u.get('sku') ?? '', u.get('from') ?? ymd(new Date()), days) });
}
