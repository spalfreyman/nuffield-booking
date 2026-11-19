import { NextResponse } from 'next/server';
import { listAllProducts, ready } from '@/lib/catalogue';
export const dynamic = 'force-dynamic';
export async function GET() {
  await ready();
  return NextResponse.json({ services: listAllProducts().map((p) => ({ sku: p.sku, name: p.name, family: p.family, durationMins: p.durationMins, formats: p.formats })) });
}
