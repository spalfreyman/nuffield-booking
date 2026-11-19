// Catalogue adapter. Reads the seed JSON in ../data. Swap the body of these
// functions for commercetools calls (product projections / channels) once a project exists.
import fs from 'node:fs';
import path from 'node:path';
import type { Audience, Family, Format, Location, Product } from './types';
import { ctAll, ctConfigured } from './ct';

const dataDir = path.join(process.cwd(), '..', 'data');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));

export const FAMILIES: Family[] = [
  { key: 'health-assessments', title: 'Health assessments', blurb: 'Understand your health and future risks with our assessments and health checks.' },
  { key: 'gp', title: 'GP appointments', blurb: 'Face to face and remote appointments with a Nuffield Health private GP.' },
  { key: 'physio', title: 'Muscle, bone and joints', blurb: 'Physiotherapy to help with all kinds of pain, in person or online.' },
  { key: 'tests-scans', title: 'Tests and scans', blurb: 'MRI, CT, X-ray and blood tests.' },
  { key: 'consultations', title: 'Hospital consultations', blurb: 'See a consultant to discuss treatment options.' },
  { key: 'gyms', title: 'Gym tours and personal training', blurb: 'Tour your local club or book a personal training session.' },
];

const BADGES: Record<string, string> = { 'ha-360-plus': 'In-depth', 'ha-360': 'Popular', 'ha-lifestyle': 'Essential' };
const REMOTE_OK = new Set(['gp', 'physio', 'consultations']);

type Seed = {
  key: string; sku: string; category: string; name: string; description: string; durationMins?: number;
  bookingMode?: string; requiresReferral?: boolean;
  prices: Record<Audience, number>;
  channelPrices?: Record<string, Record<Audience, number>>;
  formats?: Format[]; leadHours?: number;
};

interface Cache { at: number; source: 'commercetools' | 'seed'; products: Seed[]; locations: Location[]; offers: Map<string, Set<string>> | null }
const g = globalThis as any;
const TTL_MS = 60_000;

function loadSeed(): Cache {
  const products = (read('products-services.json').products as Seed[]).filter((p) => p.bookingMode !== 'purchase');
  const locations: Location[] = (read('locations.json') as any[]).map(channelToLocation);
  return { at: Date.now(), source: 'seed', products, locations, offers: null };
}

function channelToLocation(c: any): Location {
  const f = c.custom?.fields ?? {};
  return {
    key: c.key, name: c.name['en-GB'] ?? Object.values(c.name)[0], type: f.locationType, town: f.town, pricingRegion: f.pricingRegion,
    lat: c.geoLocation?.coordinates?.[1] ?? 0, lng: c.geoLocation?.coordinates?.[0] ?? 0,
  };
}

const AUD_BY_GROUP: Record<string, Audience> = { 'cg-insurance': 'insurance', 'cg-gym-member': 'gym', 'cg-business': 'business' };
const TYPE_FAMILY: Record<string, string> = {
  'nh-health-assessment': 'health-assessments', 'nh-physio': 'physio', 'nh-gp': 'gp', 'nh-diagnostic': 'tests-scans',
  'nh-consultation': 'consultations', 'nh-gym-service': 'gyms',
};

async function loadCommercetools(): Promise<Cache> {
  const [channels, types, inventory] = await Promise.all([
    ctAll<any>('/channels'), ctAll<any>('/product-types'), ctAll<any>('/inventory'),
  ]);
  const chanById = new Map<string, any>(channels.map((c) => [c.id, c]));
  const locations = channels.filter((c) => c.custom?.fields?.locationType && c.key !== REMOTE_LOCATION.key && c.geoLocation).map(channelToLocation);
  const londonIds = new Set(channels.filter((c) => c.custom?.fields?.pricingRegion === 'london').map((c) => c.id));

  const svcTypes = types.filter((t) => TYPE_FAMILY[t.key]);
  const typeKeyById = new Map(svcTypes.map((t) => [t.id, t.key as string]));
  const where = encodeURIComponent(`productType(id in (${svcTypes.map((t) => `"${t.id}"`).join(',')}))`);
  const projections = await ctAll<any>(`/product-projections?where=${where}&expand=${encodeURIComponent('masterVariant.prices[*].customerGroup')}`);

  const products: Seed[] = projections.map((pp) => {
    const v = pp.masterVariant;
    const attr = (n: string) => v.attributes?.find((a: any) => a.name === n)?.value;
    const prices: any = {}, channelPrices: any = { london: {} };
    for (const pr of v.prices ?? []) {
      const aud: Audience = pr.customerGroup ? AUD_BY_GROUP[pr.customerGroup.obj?.key] : 'public';
      if (!aud) continue;
      if (pr.channel) { if (londonIds.has(pr.channel.id)) channelPrices.london[aud] = pr.value.centAmount; }
      else prices[aud] = pr.value.centAmount;
    }
    const family = TYPE_FAMILY[typeKeyById.get(pp.productType.id)!];
    return {
      key: pp.key, sku: v.sku, category: `cat-${family}`, name: pp.name['en-GB'], description: pp.description?.['en-GB'] ?? '',
      durationMins: attr('slotDurationMins'), bookingMode: attr('bookingMode'), requiresReferral: attr('requiresReferral'),
      formats: attr('formats'), leadHours: attr('leadTimeHours'),
      prices, channelPrices: Object.keys(channelPrices.london).length ? channelPrices : undefined,
    } as Seed;
  });

  const offers = new Map<string, Set<string>>();
  for (const e of inventory) {
    const key = e.supplyChannel && chanById.get(e.supplyChannel.id)?.key;
    if (!key) continue;
    if (!offers.has(e.sku)) offers.set(e.sku, new Set());
    offers.get(e.sku)!.add(key);
  }
  return { at: Date.now(), source: 'commercetools', products, locations, offers };
}

/** Call at the top of every route handler before using the sync catalogue helpers. */
export async function ready(): Promise<Cache> {
  const c: Cache | undefined = g.__nhCat;
  if (c && Date.now() - c.at < TTL_MS) return c;
  if (!g.__nhCatLoading) {
    g.__nhCatLoading = (async () => {
      try {
        g.__nhCat = ctConfigured() ? await loadCommercetools() : loadSeed();
      } catch (e) {
        console.error('[catalogue] commercetools load failed, using', g.__nhCat ? 'stale cache:' : 'seed data:', (e as Error).message, (e as any).cause ?? '');
        g.__nhCat = g.__nhCat ?? loadSeed();
        g.__nhCat.at = Date.now() - TTL_MS + 10_000; // retry in 10s
      } finally { g.__nhCatLoading = null; }
    })();
  }
  await g.__nhCatLoading;
  return g.__nhCat;
}

function load(): Cache {
  if (!g.__nhCat) g.__nhCat = loadSeed(); // sync fallback; routes should await ready() first
  return g.__nhCat;
}
export const catalogueSource = () => load().source;

export const REMOTE_LOCATION: Location = {
  key: 'loc-remote', name: 'Remote appointment (phone or video)', type: 'remote', town: 'Anywhere in the UK',
  pricingRegion: 'outside-london', lat: 0, lng: 0,
};

export function toProduct(p: Seed, audience: Audience, region: 'london' | 'outside-london' = 'outside-london'): Product {
  const family = p.category.replace('cat-', '');
  const regional = p.channelPrices?.[region];
  const price = (regional ?? p.prices)[audience] ?? null;
  return {
    key: p.key, sku: p.sku, family, name: p.name, description: p.description,
    durationMins: p.durationMins ?? 30,
    badge: BADGES[p.key],
    formats: p.formats?.length ? p.formats : REMOTE_OK.has(family) ? ['in-person', 'remote'] : ['in-person'],
    price,
    publicPrice: (regional ?? p.prices).public ?? null,
    priceFrom: !!p.channelPrices,
    leadHours: p.leadHours ?? (family === 'health-assessments' ? 48 : 4),
    requiresReferral: p.requiresReferral,
  };
}

export function listProducts(family: string, format: Format, audience: Audience, region?: 'london' | 'outside-london'): Product[] {
  return load().products
    .filter((p) => p.category === `cat-${family}`)
    .map((p) => toProduct(p, audience, region))
    .filter((p) => p.formats.includes(format));
}

export function getProduct(sku: string, audience: Audience, region?: 'london' | 'outside-london'): Product | null {
  const p = load().products.find((x) => x.sku === sku);
  return p ? toProduct(p, audience, region) : null;
}

export function listAllProducts(): Product[] {
  return load().products.map((p) => toProduct(p, 'public'));
}

export function listFamiliesWithProducts(): Family[] {
  const have = new Set(load().products.map((p) => p.category.replace('cat-', '')));
  return FAMILIES.filter((f) => have.has(f.key));
}

export function allLocations(): Location[] {
  return load().locations;
}

/** Which locations offer which service (mirrors commercetools inventory entries per channel). */
export function locationOffers(loc: Location, p: Product): boolean {
  if (loc.type === 'remote') return p.formats.includes('remote');
  if (!p.formats.includes('in-person')) return false;
  const inv = load().offers;
  if (inv) return inv.get(p.sku)?.has(loc.key) ?? false;
  switch (loc.type) {
    case 'hospital': return p.family !== 'gyms';
    case 'diagnostic-suite': return ['health-assessments', 'tests-scans', 'physio', 'consultations'].includes(p.family);
    case 'medical-centre': return ['health-assessments', 'gp', 'physio'].includes(p.family) || p.sku === 'NH-TEST-BLOOD';
    case 'gym': return p.family === 'physio' || p.family === 'gyms';
    default: return false;
  }
}

export function getLocation(key: string): Location | undefined {
  return key === REMOTE_LOCATION.key ? REMOTE_LOCATION : load().locations.find((l) => l.key === key);
}

export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// --- Geocoding (mock). Replace with postcodes.io / Google Places. ---
const AREAS: Record<string, [string, number, number]> = {
  EC: ['London', 51.517, -0.09], WC: ['London', 51.518, -0.12], E: ['London', 51.53, -0.03], N: ['London', 51.56, -0.11],
  NW: ['London', 51.55, -0.17], SE: ['London', 51.48, -0.06], SW: ['London', 51.46, -0.17], W: ['London', 51.51, -0.2],
  M: ['Manchester', 53.48, -2.24], B: ['Birmingham', 52.48, -1.9], LS: ['Leeds', 53.8, -1.55], L: ['Liverpool', 53.41, -2.98],
  BS: ['Bristol', 51.45, -2.59], G: ['Glasgow', 55.86, -4.25], EH: ['Edinburgh', 55.95, -3.19], CF: ['Cardiff', 51.48, -3.18],
  NE: ['Newcastle', 54.98, -1.61], OX: ['Oxford', 51.75, -1.26], CB: ['Cambridge', 52.2, 0.12], GU: ['Guildford', 51.24, -0.57],
  BN: ['Brighton', 50.83, -0.14], S: ['Sheffield', 53.38, -1.47], NG: ['Nottingham', 52.95, -1.15], LE: ['Leicester', 52.63, -1.13],
  YO: ['York', 53.96, -1.08], EX: ['Exeter', 50.72, -3.53], SO: ['Southampton', 50.9, -1.4], RG: ['Reading', 51.45, -0.97],
  IP: ['Ipswich', 52.06, 1.15], DE: ['Derby', 52.92, -1.48], PL: ['Plymouth', 50.37, -4.14], TA: ['Taunton', 51.02, -3.1],
};
const CITIES: [string, number, number][] = Object.values(AREAS).map(([n, la, ln]) => [n, la, ln] as [string, number, number]);

export function geocode(q: string) {
  const query = q.trim();
  if (query.length < 2) return [];
  const out: import('./types').GeoResult[] = [];
  const pc = query.toUpperCase().match(/^([A-Z]{1,2})(\d[A-Z\d]?)\s*(\d[A-Z]{2})?$/);
  if (pc) {
    const a = AREAS[pc[1]];
    if (a) {
      const pretty = pc[3] ? `${pc[1]}${pc[2]} ${pc[3]}` : `${pc[1]}${pc[2]}`;
      out.push({ label: `${a[0]} ${pretty}, UK`, lat: a[1], lng: a[2], kind: 'postcode' });
    }
  }
  const ql = query.toLowerCase();
  const seen = new Set<string>();
  for (const [n, la, ln] of CITIES) {
    if (n.toLowerCase().startsWith(ql) && !seen.has(n)) { seen.add(n); out.push({ label: `${n}, UK`, lat: la, lng: ln, kind: 'city' }); }
  }
  for (const l of allLocations()) {
    if (l.name.toLowerCase().includes(ql) || l.town.toLowerCase().includes(ql)) {
      out.push({ label: l.name, lat: l.lat, lng: l.lng, kind: 'location', locationKey: l.key });
    }
  }
  return out.slice(0, 8);
}
