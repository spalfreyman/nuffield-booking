import { NextResponse } from 'next/server';
import { createHold, releaseHold } from '@/lib/calendar';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const { slotId } = await req.json();
  const hold = createHold(slotId);
  return hold ? NextResponse.json(hold) : NextResponse.json({ error: 'slot_unavailable' }, { status: 409 });
}
export function DELETE(req: Request) {
  releaseHold(new URL(req.url).searchParams.get('id') ?? '');
  return NextResponse.json({ ok: true });
}
