// One-off, idempotent: (1) remove funding fields that don't apply to the order's customer type,
// (2) fill in the readable appointment fields from the line item. Usage: node scripts/fix-orders.mjs [--apply]
import { readFileSync } from 'node:fs';
const APPLY = process.argv.includes('--apply');
const env = {};
for (const l of readFileSync(new URL('../nuffield_presales_demo_claude.env', import.meta.url), 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"|"$/g, ''); }
const tok = (await (await fetch(env.CTP_AUTH_URL.replace(/\/$/, '') + '/oauth/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(env.CTP_CLIENT_ID + ':' + env.CTP_CLIENT_SECRET).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' })).json()).access_token;
const ct = async (m, p, b) => { const r = await fetch(`${env.CTP_API_URL}/${env.CTP_PROJECT_KEY}${p}`, { method: m, headers: { Authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); return { status: r.status, json: t ? JSON.parse(t) : null }; };

const RELEVANT = { public: [], insurance: ['insurer', 'policyNumber', 'authCode'], gym: ['membershipNumber'], business: ['companyCode'] };
const FUNDING = ['insurer', 'policyNumber', 'authCode', 'membershipNumber', 'companyCode'];
const TZ = 'Europe/London';
const label = (s, e) => {
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(s)).replace(',', '');
  const t = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d));
  return `${day}, ${t(s)}–${t(e)} (UK time)`;
};
const channels = new Map();
let off = 0;
for (;;) { const r = await ct('GET', `/channels?limit=100&offset=${off}`); r.json.results.forEach((c) => channels.set(c.id, c.name['en-GB'] ?? Object.values(c.name)[0])); off += 100; if (off >= r.json.total) break; }

let total = 0, cleaned = 0, timed = 0, skipped = 0;
off = 0;
for (;;) {
  const r = await ct('GET', `/orders?limit=100&offset=${off}&sort=createdAt%20asc`);
  for (const o of r.json.results) {
    total++;
    const f = o.custom?.fields; if (!f?.audience) { skipped++; continue; }
    const li = o.lineItems?.[0]; const lf = li?.custom?.fields ?? {};
    const actions = [];
    for (const k of FUNDING) if (f[k] !== undefined && !RELEVANT[f.audience]?.includes(k)) actions.push({ action: 'setCustomField', name: k });
    if (actions.length) cleaned++;
    if (lf.startsAt && lf.endsAt) {
      const want = { appointmentTime: label(lf.startsAt, lf.endsAt), appointmentStartsAt: lf.startsAt, appointmentEndsAt: lf.endsAt, appointmentLocation: channels.get(li.distributionChannel?.id), appointmentService: li.name?.['en-GB'] };
      let t = false;
      for (const [k, v] of Object.entries(want)) if (v && f[k] !== v) { actions.push({ action: 'setCustomField', name: k, value: v }); t = true; }
      if (t) timed++;
      if (lf.appointmentTime !== want.appointmentTime) actions.push({ action: 'setLineItemCustomField', lineItemId: li.id, name: 'appointmentTime', value: want.appointmentTime });
    }
    if (!actions.length) continue;
    console.log(`${o.orderNumber} (${f.audience}): ${actions.map((a) => a.name + (a.value === undefined ? '=∅' : '')).join(', ')}`);
    if (APPLY) { const u = await ct('POST', `/orders/${o.id}`, { version: o.version, actions }); if (u.status !== 200) console.error('  FAILED', u.status, JSON.stringify(u.json?.errors?.[0])); }
  }
  off += 100; if (off >= r.json.total) break;
}
console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN'}: ${total} orders, ${cleaned} with irrelevant funding fields removed, ${timed} with appointment fields filled, ${skipped} not booking orders`);
