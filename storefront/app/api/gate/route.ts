import { NextResponse } from 'next/server';
import { GATE_COOKIE, tokenFor, tokenValid } from '@/lib/gate';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const { password, next } = (await req.json().catch(() => ({}))) as { password?: string; next?: string };
  const token = await tokenFor(String(password ?? ''));
  if (!(await tokenValid(token))) return NextResponse.json({ ok: false }, { status: 401 });
  const dest = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const res = NextResponse.json({ ok: true, next: dest });
  res.cookies.set(GATE_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 14 });
  return res;
}
