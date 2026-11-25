// Signed "booking link" tokens: <cartId>.<hmac>. The link carries access to the storefront for that one selection,
// so it can be shared with a customer without the site password. Works in Edge middleware and Node routes.
export const SHARE_COOKIE = 'nh_share';
const secret = () => process.env.SHARE_SECRET || process.env.CTP_CLIENT_SECRET || 'nuffield-share-dev-secret';
async function hmac(text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
const same = (a: string, b: string) => { let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; };
export async function shareToken(cartId: string) { return `${cartId}.${await hmac(cartId)}`; }
/** Returns the cart id when the token is genuine, else null. */
export async function verifyShareToken(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const i = token.lastIndexOf('.');
  if (i < 1) return null;
  const id = token.slice(0, i);
  return same(token.slice(i + 1), await hmac(id)) ? id : null;
}
