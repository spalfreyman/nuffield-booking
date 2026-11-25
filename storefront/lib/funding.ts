import type { Audience } from './types';
/** Which funding details apply to each customer type. Everything else is dropped before it reaches the order. */
export const RELEVANT_FUNDING: Record<Audience, string[]> = {
  public: [],
  insurance: ['insurer', 'policy', 'authCode'],
  gym: ['membership'],
  business: ['company'],
};
export function relevantFunding(audience: Audience, funding: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of RELEVANT_FUNDING[audience] ?? []) if (funding?.[k]?.trim()) out[k] = funding[k].trim();
  return out;
}
