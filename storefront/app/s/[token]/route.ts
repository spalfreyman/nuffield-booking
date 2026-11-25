import { NextResponse } from 'next/server';
import { ct } from '@/lib/ct';
import { SHARE_COOKIE, verifyShareToken } from '@/lib/share';
export const dynamic = 'force-dynamic';

// Booking link entry point: /s/<cartId>.<signature>. Genuine links set a cookie that lets the customer through the
// site gate and open the booking flow with the selection from the cart pre-filled.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cartId = await verifyShareToken(decodeURIComponent(token));
  const gone = () => new NextResponse('This booking link is not valid.', { status: 404 });
  if (!cartId) return gone();
  const cart = await ct('GET', `/carts/${cartId}`).catch(() => null);
  if (!cart || cart.custom?.fields?.source !== 'merchant-center-link') return gone();
  const res = NextResponse.redirect(new URL(`/book?cart=${cartId}`, req.url));
  res.cookies.set(SHARE_COOKIE, decodeURIComponent(token), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 14 });
  return res;
}
