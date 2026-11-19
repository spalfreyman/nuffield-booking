export type Audience = 'public' | 'insurance' | 'gym' | 'business';
export type Format = 'in-person' | 'remote';

export const AUDIENCES: { key: Audience; title: string; blurb: string; customerGroup: string | null }[] = [
  { key: 'public', title: 'Self-pay customer', blurb: 'You pay for each appointment yourself.', customerGroup: null },
  { key: 'insurance', title: 'Medical insurance customer', blurb: 'Your insurer funds your appointment (authorisation may be needed).', customerGroup: 'cg-insurance' },
  { key: 'gym', title: 'Nuffield Health gym member', blurb: 'Member prices apply. You will need your membership number.', customerGroup: 'cg-gym-member' },
  { key: 'business', title: 'Business customer', blurb: 'Your health benefits are paid for by your employer.', customerGroup: 'cg-business' },
];

export interface Family {
  key: string;
  title: string;
  blurb: string;
}

export interface Product {
  key: string;
  sku: string;
  family: string;
  name: string;
  description: string;
  durationMins: number;
  badge?: string;
  formats: Format[];
  /** price for the requested audience in pence, null if not priced */
  price: number | null;
  publicPrice: number | null;
  priceFrom?: boolean;
  leadHours: number;
  requiresReferral?: boolean;
}

export interface Location {
  key: string;
  name: string;
  type: string;
  town: string;
  pricingRegion: 'london' | 'outside-london';
  lat: number;
  lng: number;
}

export interface Clinic extends Location {
  distanceMiles: number;
  firstAvailable: string | null; // ISO
}

export interface Slot {
  slotId: string;
  startsAt: string;
  endsAt: string;
  clinicianId: string;
  remaining: number;
}

export interface GeoResult {
  label: string;
  lat: number;
  lng: number;
  kind: 'postcode' | 'city' | 'location';
  locationKey?: string;
}

export const gbp = (pence: number | null) =>
  pence == null ? '' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
