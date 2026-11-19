import { NextResponse } from 'next/server';
import { catalogueSource, ready } from '@/lib/catalogue';
export const dynamic = 'force-dynamic';
export async function GET() { const c = await ready(); return NextResponse.json({ source: catalogueSource(), products: c.products.length, locations: c.locations.length, inventoryBacked: !!c.offers }); }
