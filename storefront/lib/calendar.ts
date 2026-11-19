// Mock calendar service. Deterministic availability per (location, sku, day);
// holds and bookings are in-memory. Mirrors the contract in docs/02:
//   availability / holds / bookings. Replace with the real calendar service later.
import { getLocation, getProduct } from './catalogue';
import type { Audience, Slot } from './types';

const g = globalThis as any;
const holds: Map<string, { slotId: string; expires: number }> = (g.__nhHolds ??= new Map());
const bookings: Map<string, Booking> = (g.__nhBookings ??= new Map());
const taken: Set<string> = (g.__nhTaken ??= new Set());

export const HOLD_TTL_MS = 10 * 60 * 1000;

export interface Booking {
  reference: string;
  slotId: string;
  sku: string;
  locationKey: string;
  startsAt: string;
  audience: Audience;
  price: number | null;
  patient: Record<string, string>;
  funding: Record<string, string>;
  paymentToken: string | null;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
  orderId?: string;
  orderError?: string;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Europe/London offset (minutes) for a UTC date: BST last Sun Mar -> last Sun Oct. */
function londonOffsetMins(d: Date) {
  const y = d.getUTCFullYear();
  const lastSun = (m: number) => { const x = new Date(Date.UTC(y, m + 1, 0, 1)); x.setUTCDate(x.getUTCDate() - x.getUTCDay()); return x; };
  return d >= lastSun(2) && d < lastSun(9) ? 60 : 0;
}
function localToUtc(dateISO: string, hh: number, mm: number) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  return new Date(guess.getTime() - londonOffsetMins(guess) * 60000);
}

function openHours(type: string, dow: number): [number, number] | null {
  if (type === 'remote') return [7, 21];
  if (type === 'gym') return dow === 0 ? [9, 16] : [7, 20];
  if (dow === 0) return null;
  return dow === 6 ? [8, 13] : [8, 18];
}
const CLINICIANS: Record<string, number> = { hospital: 3, 'diagnostic-suite': 2, 'medical-centre': 2, gym: 1, remote: 4 };

function isTaken(slotId: string) {
  if (taken.has(slotId)) return true;
  const now = Date.now();
  for (const [id, h] of holds) {
    if (h.expires < now) holds.delete(id);
    else if (h.slotId === slotId) return true;
  }
  return false;
}

export function slotsForDay(locationKey: string, sku: string, dateISO: string): Slot[] {
  const loc = getLocation(locationKey);
  const product = getProduct(sku, 'public');
  if (!loc || !product) return [];
  const [y, m, d] = dateISO.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const hours = openHours(loc.type, dow);
  if (!hours) return [];
  const dur = product.durationMins;
  const minStart = Date.now() + product.leadHours * 3600_000;
  // some days are fully booked for realism
  const dayBusy = hash(`${locationKey}|${dateISO}`) % 100;
  const busy = dayBusy < 8 ? 100 : dow === 6 || dow === 0 ? 55 : 35 + (hash(locationKey) % 25);
  const n = CLINICIANS[loc.type] ?? 1;
  const out: Slot[] = [];
  for (let t = hours[0] * 60; t + dur <= hours[1] * 60; t += Math.max(dur, 30)) {
    const start = localToUtc(dateISO, Math.floor(t / 60), t % 60);
    if (start.getTime() < minStart) continue;
    const end = new Date(start.getTime() + dur * 60000);
    const free: string[] = [];
    for (let c = 1; c <= n; c++) {
      const clin = `${loc.key}-c${c}`;
      const slotId = `${loc.key}|${sku}|${start.toISOString()}|${clin}`;
      if (hash(slotId) % 100 >= busy && !isTaken(slotId)) free.push(slotId);
    }
    if (free.length) {
      out.push({ slotId: free[0], startsAt: start.toISOString(), endsAt: end.toISOString(), clinicianId: free[0].split('|')[3], remaining: free.length });
    }
  }
  return out;
}

export function ymd(d: Date) { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }

export function availability(locationKey: string, sku: string, fromISO: string, days: number) {
  const out: Record<string, Slot[]> = {};
  const [y, m, d] = fromISO.split('-').map(Number);
  for (let i = 0; i < days; i++) {
    const day = ymd(new Date(Date.UTC(y, m - 1, d + i)));
    const s = slotsForDay(locationKey, sku, day);
    if (s.length) out[day] = s;
  }
  return out;
}

export function firstAvailable(locationKey: string, sku: string, fromISO: string, horizonDays = 60): string | null {
  const [y, m, d] = fromISO.split('-').map(Number);
  for (let i = 0; i < horizonDays; i++) {
    const day = ymd(new Date(Date.UTC(y, m - 1, d + i)));
    const s = slotsForDay(locationKey, sku, day);
    if (s.length) return s[0].startsAt;
  }
  return null;
}

export function createHold(slotId: string) {
  if (isTaken(slotId)) return null;
  const holdId = `hold_${hash(slotId + Date.now()).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const expires = Date.now() + HOLD_TTL_MS;
  holds.set(holdId, { slotId, expires });
  return { holdId, slotId, expiresAt: new Date(expires).toISOString() };
}

export function releaseHold(holdId: string) { holds.delete(holdId); }

export function confirmBooking(input: Omit<Booking, 'reference' | 'status' | 'createdAt' | 'slotId'> & { holdId: string }) {
  const h = holds.get(input.holdId);
  if (!h || h.expires < Date.now()) return { error: 'hold_expired' as const };
  holds.delete(input.holdId);
  taken.add(h.slotId);
  const reference = `NH${Date.now().toString(36).toUpperCase().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
  const { holdId: _h, ...rest } = input;
  const booking: Booking = { ...rest, slotId: h.slotId, reference, status: 'confirmed', createdAt: new Date().toISOString() };
  bookings.set(reference, booking);
  return { booking };
}

export function getBooking(ref: string) { return bookings.get(ref) ?? null; }
export function allBookings() { return [...bookings.values()]; }

// ---------- Admin / Merchant Center views ----------
export interface GridCell { startsAt: string; endsAt: string; capacity: number; free: number; held: number; booked: number; busy: number }

function slotState(slotId: string): 'booked' | 'held' | 'open' {
  if (taken.has(slotId)) return 'booked';
  const now = Date.now();
  for (const [id, h] of holds) { if (h.expires < now) holds.delete(id); else if (h.slotId === slotId) return 'held'; }
  return 'open';
}

/** Full per-time utilisation for one location/service/day. Unlike slotsForDay it ignores lead time and shows used capacity. */
export function gridForDay(locationKey: string, sku: string, dateISO: string): GridCell[] {
  const loc = getLocation(locationKey);
  const product = getProduct(sku, 'public');
  if (!loc || !product) return [];
  const [y, m, d] = dateISO.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const hours = openHours(loc.type, dow);
  if (!hours) return [];
  const dur = product.durationMins;
  const dayBusy = hash(`${locationKey}|${dateISO}`) % 100;
  const busyPct = dayBusy < 8 ? 100 : dow === 6 || dow === 0 ? 55 : 35 + (hash(locationKey) % 25);
  const n = CLINICIANS[loc.type] ?? 1;
  const out: GridCell[] = [];
  for (let t = hours[0] * 60; t + dur <= hours[1] * 60; t += Math.max(dur, 30)) {
    const start = localToUtc(dateISO, Math.floor(t / 60), t % 60);
    const cell: GridCell = { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + dur * 60000).toISOString(), capacity: n, free: 0, held: 0, booked: 0, busy: 0 };
    for (let c = 1; c <= n; c++) {
      const slotId = `${loc.key}|${sku}|${start.toISOString()}|${loc.key}-c${c}`;
      const st = slotState(slotId);
      if (st === 'booked') cell.booked++;
      else if (st === 'held') cell.held++;
      else if (hash(slotId) % 100 < busyPct) cell.busy++;
      else cell.free++;
    }
    out.push(cell);
  }
  return out;
}

export function summariseGrid(cells: GridCell[]) {
  return cells.reduce((a, c) => ({ capacity: a.capacity + c.capacity, free: a.free + c.free, used: a.used + c.capacity - c.free }), { capacity: 0, free: 0, used: 0 });
}
