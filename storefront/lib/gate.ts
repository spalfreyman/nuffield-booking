// Site password gate. The password itself is never stored: the cookie holds SHA-256(password) and the server
// checks SHA-256(cookie + SALT) against GATE_HASH. Works in the Edge middleware and in Node route handlers.
export const GATE_COOKIE = 'nh_gate';
const SALT = 'nuffield-gate-v1';
// Override per environment with GATE_HASH (= sha256(sha256(password) + SALT)); set GATE_DISABLED=1 to switch the gate off.
export const GATE_HASH = process.env.GATE_HASH || '18f331454c36ee961129283af790cb9c8cfbbbf12fbbf473e192bb3e00411137';
export const gateDisabled = () => process.env.GATE_DISABLED === '1';

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const safeEqual = (a: string, b: string) => {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
};
/** token = sha256(password) */
export async function tokenValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  return safeEqual(await sha256(token + SALT), GATE_HASH);
}
export const tokenFor = (password: string) => sha256(password);
