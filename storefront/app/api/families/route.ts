import { NextResponse } from 'next/server';
import { listFamiliesWithProducts, ready } from '@/lib/catalogue';
export const dynamic = 'force-dynamic';
export async function GET() { await ready(); return NextResponse.json({ families: listFamiliesWithProducts() }); }
