import { NextResponse } from 'next/server';
import { geocode, ready } from '@/lib/catalogue';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { await ready(); return NextResponse.json({ results: geocode(new URL(req.url).searchParams.get('q') ?? '') }); }
