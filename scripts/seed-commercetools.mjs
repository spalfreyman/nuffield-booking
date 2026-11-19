// Idempotent seed of the Nuffield booking catalogue into a commercetools project.
// Usage: node scripts/seed-commercetools.mjs [--env nuffield_presales_demo_claude.env] [--dry-run] [--skip-treatments] [--skip-diagnostics]
// Everything is keyed; re-running skips resources that already exist.
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const envIdx = args.indexOf('--env');
const envFile = envIdx >= 0 ? args[envIdx + 1] : 'nuffield_presales_demo_claude.env';
const DRY = flag('--dry-run');
const root = new URL('../', import.meta.url);
const data = (f) => JSON.parse(readFileSync(new URL(`data/${f}`, root), 'utf8'));

// --- env (values contain spaces, so don't `source` the file) ---
const env = {};
for (const l of readFileSync(new URL(envFile, root), 'utf8').split('\n')) {
  const i = l.indexOf('=');
  if (i > 0 && !l.trim().startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"|"$/g, '');
}
const P = env.CTP_PROJECT_KEY, API = env.CTP_API_URL;

let token;
async function auth() {
  const r = await fetch(env.CTP_AUTH_URL.replace(/\/$/, '') + '/oauth/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${env.CTP_CLIENT_ID}:${env.CTP_CLIENT_SECRET}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  token = (await r.json()).access_token;
  if (!token) throw new Error('auth failed');
}
async function ct(method, path, body, attempt = 0) {
  const r = await fetch(`${API}/${P}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401 && attempt < 2) { await auth(); return ct(method, path, body, attempt + 1); }
  if ((r.status === 429 || r.status >= 500) && attempt < 5) { await new Promise((s) => setTimeout(s, 500 * 2 ** attempt)); return ct(method, path, body, attempt + 1); }
  const text = await r.text();
  const json = text ? JSON.parse(text) : null;
  return { status: r.status, json };
}

const stats = {};
const bump = (k, w) => { (stats[k] ??= { created: 0, existed: 0, failed: 0 })[w]++; };
async function ensure(resource, key, draft, label = resource) {
  const got = await ct('GET', `/${resource}/key=${encodeURIComponent(key)}`);
  if (got.status === 200) { bump(label, 'existed'); return got.json; }
  if (DRY) { bump(label, 'created'); return null; }
  const r = await ct('POST', `/${resource}`, draft);
  if (r.status === 201) { bump(label, 'created'); return r.json; }
  bump(label, 'failed');
  console.error(`FAIL ${label} ${key}: ${r.status} ${JSON.stringify(r.json?.errors?.[0] ?? r.json).slice(0, 300)}`);
  return null;
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const it = items[i++]; await fn(it); } }));
}

const L = (s) => ({ 'en-GB': s });
const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/\+/g, '-plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

await auth();

// --- 0. project settings: GBP / en-GB / GB ---
{
  const { json: proj } = await ct('GET', '');
  const actions = [];
  if (!proj.languages.includes('en-GB')) actions.push({ action: 'changeLanguages', languages: [...proj.languages, 'en-GB'] });
  if (!proj.currencies.includes('GBP')) actions.push({ action: 'changeCurrencies', currencies: [...proj.currencies, 'GBP'] });
  if (!proj.countries.includes('GB')) actions.push({ action: 'changeCountries', countries: [...proj.countries, 'GB'] });
  console.log('project:', { languages: proj.languages, currencies: proj.currencies, countries: proj.countries, adding: actions.map((a) => a.action) });
  if (actions.length && !DRY) {
    const r = await ct('POST', '', { version: proj.version, actions });
    if (r.status !== 200) throw new Error('project update failed ' + JSON.stringify(r.json));
  }
}

// --- 1. custom types ---
const f = (name, type = 'String') => ({ name, label: L(name), required: false, type: { name: type }, inputHint: 'SingleLine' });
const CUSTOM_TYPES = [
  { key: 'nh-location', name: L('Nuffield location'), resourceTypeIds: ['channel'], fieldDefinitions: [f('locationType'), f('town'), f('region'), f('pricingRegion'), f('timezone'), f('calendarResourceId'), f('url'), f('addressTodo', 'Boolean'), f('geoApprox', 'Boolean')] },
  { key: 'nh-inventory', name: L('Nuffield service availability'), resourceTypeIds: ['inventory-entry'], fieldDefinitions: [f('defaultDurationMins', 'Number'), f('clinicianType')] },
  { key: 'nh-booking-line', name: L('Booking line item'), resourceTypeIds: ['line-item'], fieldDefinitions: [f('slotId'), f('startsAt'), f('endsAt'), f('holdId'), f('holdExpiresAt'), f('clinicianId'), f('format'), f('patient')] },
  { key: 'nh-booking-cart', name: L('Booking cart/order'), resourceTypeIds: ['order'], fieldDefinitions: [f('audience'), f('insurer'), f('policyNumber'), f('authCode'), f('membershipNumber'), f('companyCode'), f('calendarBookingId'), f('bookingStatus'), f('paymentToken')] },
];
for (const t of CUSTOM_TYPES) await ensure('types', t.key, t, 'custom-types');

// --- 2. product types ---
const A = (name, type = 'text', extra = {}) => ({ name, label: L(name), isRequired: false, type: typeof type === 'string' ? { name: type } : type, attributeConstraint: 'None', isSearchable: true, inputHint: 'SingleLine', ...extra });
const COMMON = [A('bookable', 'boolean'), A('bookingMode'), A('slotDurationMins', 'number'), A('leadTimeHours', 'number'), A('cancellationHours', 'number'), A('formats', { name: 'set', elementType: { name: 'text' } })];
const PT = (key, name, description, extra = []) => ({ key, name, description, attributes: [...COMMON, ...extra] });
const PRODUCT_TYPES = [
  PT('nh-health-assessment', 'Health assessment', 'Bookable health assessments', [A('resultsDays', 'number'), A('gymPassDays', 'number'), A('financeAvailable', 'boolean')]),
  PT('nh-physio', 'Physiotherapy', 'Physiotherapy appointments', [A('appointmentType')]),
  PT('nh-gp', 'Private GP', 'Private GP appointments'),
  PT('nh-diagnostic', 'Test or scan', 'Imaging and diagnostics', [A('modality'), A('requiresReferral', 'boolean'), A('testGroup'), A('resultsDays', 'number'), A('priceOnEnquiry', 'boolean')]),
  PT('nh-consultation', 'Consultation', 'Consultant consultations', [A('specialty')]),
  PT('nh-treatment', 'Hospital treatment', 'Treatment information (price on enquiry)', [A('specialty'), A('sourceUrl')]),
  PT('nh-gym-membership', 'Gym membership', 'Gym membership tiers', [A('termMonths', 'number'), A('gymAccessTier')]),
  PT('nh-gym-service', 'Gym service', 'Tours, personal training', []),
];
for (const t of PRODUCT_TYPES) await ensure('product-types', t.key, t, 'product-types');
// Existing projects: add any attribute definitions a product type is missing (idempotent).
for (const t of PRODUCT_TYPES) {
  const cur = await ct('GET', `/product-types/key=${t.key}`);
  if (cur.status !== 200) continue;
  const have = new Set(cur.json.attributes.map((a) => a.name));
  const actions = t.attributes.filter((a) => !have.has(a.name)).map((attribute) => ({ action: 'addAttributeDefinition', attribute }));
  if (actions.length && !DRY) {
    const r = await ct('POST', `/product-types/key=${t.key}`, { version: cur.json.version, actions });
    console.log(`product type ${t.key}: added ${actions.map((a) => a.attribute.name).join(', ')} (${r.status})`);
  }
}

// --- 3. customer groups ---
for (const g of data('customer-groups.json')) await ensure('customer-groups', g.key, g, 'customer-groups');

// --- 4. categories ---
const SPEC = { orthopaedics: 'Orthopaedics', spine: 'Spine', 'cardiology-vascular': 'Cardiology and vascular', 'cosmetic-reconstructive': 'Cosmetic and reconstructive', ophthalmology: 'Ophthalmology', ent: 'ENT', 'urology-prostate': 'Urology and prostate', 'gynaecology-fertility': 'Gynaecology and fertility', 'general-surgery': 'General surgery and hernia', colorectal: 'Colorectal', bariatric: 'Bariatric and weight loss', oncology: 'Oncology', dermatology: 'Dermatology', 'pain-management': 'Pain management', 'dental-maxillofacial': 'Dental and maxillofacial', 'therapies-other': 'Therapies and other' };
const TOP = { 'cat-health-assessments': 'Health assessments', 'cat-physio': 'Physiotherapy', 'cat-gp': 'Private GP', 'cat-tests-scans': 'Tests and scans', 'cat-consultations': 'Consultations', 'cat-treatments': 'Hospital treatments', 'cat-gyms': 'Gyms' };
for (const [key, name] of Object.entries(TOP)) await ensure('categories', key, { key, name: L(name), slug: L(slug(name)) }, 'categories');
for (const [key, name] of [['cat-tests-blood', 'Blood and fluids'], ['cat-tests-imaging', 'Imaging and radiology']]) {
  await ensure('categories', key, { key, name: L(name), slug: L('tests-' + slug(name)), parent: { typeId: 'category', key: 'cat-tests-scans' } }, 'categories');
}
for (const [s, name] of Object.entries(SPEC)) {
  const key = `cat-tx-${s}`;
  await ensure('categories', key, { key, name: L(name), slug: L('treatments-' + slug(name)), parent: { typeId: 'category', key: 'cat-treatments' } }, 'categories');
}

// --- 5. channels (locations) ---
const locations = data('locations.json');
locations.push({
  key: 'loc-remote', roles: ['InventorySupply', 'ProductDistribution'], name: L('Remote appointment (phone or video)'),
  custom: { type: { typeId: 'type', key: 'nh-location' }, fields: { locationType: 'remote', town: 'UK-wide', region: 'uk', pricingRegion: 'outside-london', timezone: 'Europe/London', calendarResourceId: 'cal-remote' } },
});
await pool(locations, 5, (c) => ensure('channels', c.key, c, 'channels'));
const londonChannels = locations.filter((c) => c.custom.fields.pricingRegion === 'london').map((c) => c.key);

// --- 6. service products with four-audience prices ---
const svc = data('products-services.json').products;
const GROUP = { insurance: 'cg-insurance', gym: 'cg-gym-member', business: 'cg-business' };
const ptKey = (p) => p.productType;
const money = (n) => ({ currencyCode: 'GBP', centAmount: n });
const priceDrafts = (p) => {
  const out = [];
  for (const [aud, amt] of Object.entries(p.prices)) out.push({ value: money(amt), country: 'GB', ...(GROUP[aud] ? { customerGroup: { typeId: 'customer-group', key: GROUP[aud] } } : {}) });
  for (const [region, prices] of Object.entries(p.channelPrices ?? {})) {
    if (region !== 'london') continue;
    for (const ch of londonChannels) for (const [aud, amt] of Object.entries(prices)) out.push({ value: money(amt), country: 'GB', channel: { typeId: 'channel', key: ch }, ...(GROUP[aud] ? { customerGroup: { typeId: 'customer-group', key: GROUP[aud] } } : {}) });
  }
  return out;
};
const REMOTE_OK = new Set(['cat-gp', 'cat-physio', 'cat-consultations']);
const svcDraft = (p) => ({
  key: p.key, productType: { typeId: 'product-type', key: ptKey(p) }, name: L(p.name), slug: L(slug(p.name)), description: L(p.description),
  categories: [{ typeId: 'category', key: p.category }], publish: true,
  masterVariant: {
    sku: p.sku, key: p.sku, prices: priceDrafts(p),
    attributes: [
      { name: 'bookable', value: p.bookingMode !== 'purchase' },
      { name: 'bookingMode', value: p.bookingMode ?? 'slot' },
      { name: 'slotDurationMins', value: p.durationMins ?? 30 },
      { name: 'leadTimeHours', value: p.category === 'cat-health-assessments' ? 48 : 4 },
      { name: 'cancellationHours', value: 72 },
      { name: 'formats', value: REMOTE_OK.has(p.category) ? ['in-person', 'remote'] : ['in-person'] },
      ...(p.productType === 'nh-health-assessment' ? [{ name: 'resultsDays', value: 14 }, { name: 'gymPassDays', value: 30 }, { name: 'financeAvailable', value: true }] : []),
      ...(p.productType === 'nh-physio' ? [{ name: 'appointmentType', value: p.key.endsWith('initial') ? 'initial' : 'follow-up' }] : []),
      ...(p.productType === 'nh-diagnostic' ? [{ name: 'requiresReferral', value: !!p.requiresReferral }] : []),
      ...(p.productType === 'nh-gym-membership' ? [{ name: 'termMonths', value: p.termMonths ?? 12 }] : []),
    ],
  },
});
for (const p of svc) await ensure('products', p.key, svcDraft(p), 'products(services)');

// --- 7. treatments (info only, price on enquiry) ---
if (!flag('--skip-treatments')) {
  const tx = data('treatments.json');
  const seenSku = new Set();
  const drafts = tx.map((t) => {
    let sku = t.masterVariant.sku, n = 1;
    while (seenSku.has(sku)) sku = `${t.masterVariant.sku.slice(0, 56)}-${++n}`;
    seenSku.add(sku);
    return { ...t, publish: true, masterVariant: { ...t.masterVariant, sku, key: sku } };
  });
  await pool(drafts, 6, (t) => ensure('products', t.key, t, 'products(treatments)'));
}

// --- 8. inventory: which service is offered at which location ---
const offers = (type, p) => {
  const fam = p.category.replace('cat-', '');
  const remote = REMOTE_OK.has(p.category);
  if (type === 'remote') return remote;
  switch (type) {
    case 'hospital': return fam !== 'gyms';
    case 'diagnostic-suite': return ['health-assessments', 'tests-scans', 'physio', 'consultations'].includes(fam);
    case 'medical-centre': return ['health-assessments', 'gp', 'physio'].includes(fam) || p.sku === 'NH-TEST-BLOOD';
    case 'gym': return fam === 'physio' || fam === 'gyms';
    default: return false;
  }
};
const entries = [];
for (const p of svc.filter((x) => x.bookingMode !== 'purchase')) for (const loc of locations) {
  if (!offers(loc.custom.fields.locationType, p)) continue;
  entries.push({ key: `inv-${p.sku}-${loc.key}`.slice(0, 256), sku: p.sku, supplyChannel: { typeId: 'channel', key: loc.key }, quantityOnStock: loc.custom.fields.locationType === 'remote' ? 200 : 60,
    custom: { type: { typeId: 'type', key: 'nh-inventory' }, fields: { defaultDurationMins: p.durationMins ?? 30 } } });
}
await pool(entries, 6, (e) => ensure('inventory', e.key, e, 'inventory-entries'));

// --- 9. blood tests (Pathology Direct) and imaging (nuffieldhealth.com/tests-scans) ---
// Blood tests: self-pay, same price for every audience (insurance cannot be used). Imaging: price confirmed by the
// hospital after referral, so priceOnEnquiry=true with a GBP 0 placeholder price (a commercetools cart line needs a price).
if (!flag('--skip-diagnostics')) {
  const dx = data('diagnostics.json');
  const audiences = ['public', 'insurance', 'gym', 'business'];
  const dxDraft = (p, { blood }) => {
    const amount = blood ? p.pricePence : 0;
    return {
      key: p.key, productType: { typeId: 'product-type', key: 'nh-diagnostic' }, name: L(p.name), slug: L(slug(p.name)),
      description: L(blood ? `Pathology Direct blood test (${p.group}).${p.resultsDays ? ` Results in about ${p.resultsDays} days.` : ''} Self-pay only; insurance cannot be used.` : p.description),
      categories: [{ typeId: 'category', key: blood ? 'cat-tests-blood' : 'cat-tests-imaging' }], publish: true,
      masterVariant: {
        sku: p.sku, key: p.sku,
        prices: audiences.map((aud) => ({ value: money(amount), country: 'GB', ...(GROUP[aud] ? { customerGroup: { typeId: 'customer-group', key: GROUP[aud] } } : {}) })),
        attributes: [
          { name: 'bookable', value: true }, { name: 'bookingMode', value: 'slot' },
          { name: 'slotDurationMins', value: blood ? 15 : p.durationMins }, { name: 'leadTimeHours', value: blood ? 24 : 48 },
          { name: 'cancellationHours', value: 72 }, { name: 'formats', value: ['in-person'] },
          { name: 'modality', value: blood ? 'blood' : 'imaging' }, { name: 'requiresReferral', value: !blood },
          ...(blood ? [{ name: 'testGroup', value: p.group }, ...(p.resultsDays ? [{ name: 'resultsDays', value: p.resultsDays }] : [])] : [{ name: 'priceOnEnquiry', value: true }]),
        ],
      },
    };
  };
  const dxProducts = [...dx.blood.map((p) => ({ p, blood: true })), ...dx.imaging.map((p) => ({ p, blood: false }))];
  await pool(dxProducts, 6, ({ p, blood }) => ensure('products', p.key, dxDraft(p, { blood }), 'products(diagnostics)'));

  // Blood tests are offered wherever the generic blood test is (hospitals, diagnostic suites, medical centres);
  // imaging at hospitals and diagnostic suites.
  const dxOffer = (type, blood) => (blood ? ['hospital', 'diagnostic-suite', 'medical-centre'] : ['hospital', 'diagnostic-suite']).includes(type);
  const dxEntries = [];
  for (const { p, blood } of dxProducts) for (const loc of locations) {
    if (!dxOffer(loc.custom.fields.locationType, blood)) continue;
    dxEntries.push({ key: `inv-${p.sku}-${loc.key}`.slice(0, 256), sku: p.sku, supplyChannel: { typeId: 'channel', key: loc.key }, quantityOnStock: 60,
      custom: { type: { typeId: 'type', key: 'nh-inventory' }, fields: { defaultDurationMins: blood ? 15 : p.durationMins } } });
  }
  await pool(dxEntries, 8, (e) => ensure('inventory', e.key, e, 'inventory-entries(diagnostics)'));
}

console.log(DRY ? '\nDRY RUN – nothing written' : '\nDone');
console.table(stats);
