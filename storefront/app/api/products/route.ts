import { NextResponse } from 'next/server';
import { listProducts, ready } from '@/lib/catalogue';
import type { Audience, Format } from '@/lib/types';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  await ready();
  const u = new URL(req.url).searchParams;
  const products = listProducts(u.get('family') ?? '', (u.get('format') as Format) ?? 'in-person', (u.get('audience') as Audience) ?? 'public', (u.get('region') as any) ?? undefined);
  return NextResponse.json({ products });
}
