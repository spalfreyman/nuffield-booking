'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AUDIENCES, gbp } from '@/lib/types';
import { SAMPLE, pf } from '@/lib/prefill';
import { relevantFunding } from '@/lib/funding';
import type { Audience, Clinic, Family, Format, GeoResult, Location, Product, Slot } from '@/lib/types';

type Phase = 'audience' | 'family' | 'format' | 'product' | 'lead' | 'location' | 'date' | 'appointment' | 'details' | 'confirm';
const STEP: Record<Phase, number> = { audience: 0, family: 1, format: 1, product: 1, lead: 1, location: 2, date: 3, appointment: 4, details: 5, confirm: 6 };
const STEPS = ['1. Product', '2. Location', '3. Date', '4. Appointment', '5. Personal Details', '6. Confirm'];
const REMOTE_FAMILIES = new Set(['gp', 'physio', 'consultations']);
const INSURERS = ['Bupa', 'AXA Health', 'Aviva', 'Vitality', 'WPA', 'Cigna', 'Other'];

const TZ = 'Europe/London';
const fmtTime = (iso: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));
const fmtLong = (iso: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }).format(new Date(iso));
const fmtDay = (ymd: string) => new Date(ymd + 'T12:00:00Z');
const todayYmd = () => new Date().toISOString().slice(0, 10);

function priceLabel(p: Product, a: Audience) {
  if (p.price == null) return 'Price on enquiry';
  if (p.price === 0) return a === 'insurance' ? 'Covered by insurer' : 'Free';
  return (p.priceFrom ? 'from ' : '') + gbp(p.price);
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error(j.error ?? 'error'), { status: r.status, body: j });
  return j;
}

interface Hold { holdId: string; expiresAt: string }
interface Result { reference: string; startsAt: string }

export default function BookingFlow() {
  const qs = useSearchParams();
  const [phase, setPhase] = useState<Phase>('audience');
  const [stack, setStack] = useState<Phase[]>([]);
  const [audience, setAudience] = useState<Audience>('public');
  const [family, setFamily] = useState<Family | null>(null);
  const [format, setFormat] = useState<Format>('in-person');
  const [product, setProduct] = useState<Product | null>(null);
  const [geo, setGeo] = useState<GeoResult | null>(null);
  const [date, setDate] = useState(todayYmd());
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [hold, setHold] = useState<Hold | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  // booking link (/book?cart=...): selection comes from a commercetools cart created in Merchant Center
  const linkCart = qs.get('cart');
  const [cartId, setCartId] = useState<string | null>(null);
  const [cartStart, setCartStart] = useState<string | null>(null);
  const [linkState, setLinkState] = useState<'idle' | 'loading' | 'error'>(linkCart ? 'loading' : 'idle');
  const [linkError, setLinkError] = useState('');
  const linkStarted = useRef(false);
  useEffect(() => {
    if (!linkCart || linkStarted.current) return;
    linkStarted.current = true;
    (async () => {
      try {
        const r = await fetch(`/api/cart-link?id=${encodeURIComponent(linkCart)}`);
        if (r.status === 410) { setLinkError('This booking has already been completed.'); setLinkState('error'); return; }
        if (!r.ok) { setLinkError('Sorry, we could not open this booking link.'); setLinkState('error'); return; }
        const d = await r.json() as { cartId: string; audience: Audience; product: Product; family: Family; location: Location; startsAt: string; slot: Slot | null };
        const loc = d.location;
        const c: Clinic = { ...loc, distanceMiles: 0, firstAvailable: d.startsAt };
        setAudience(d.audience); setFamily(d.family); setProduct(d.product);
        setFormat(loc.type === 'remote' ? 'remote' : 'in-person');
        setGeo({ label: loc.name, lat: loc.lat, lng: loc.lng, kind: 'location', locationKey: loc.key });
        setDate(d.startsAt.slice(0, 10)); setClinic(c); setCartId(d.cartId); setCartStart(d.startsAt);
        if (d.slot) {
          try {
            const h = await api<Hold & { slotId: string }>('/api/holds', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slotId: d.slot.slotId }) });
            setSlot(d.slot); setHold(h); setStack(['appointment']); setPhase('details');
            setLinkState('idle'); return;
          } catch { /* taken in the meantime: fall through to choosing another time */ }
        }
        setFlash('That appointment time is no longer available. Please choose another time.');
        setStack(['date']); setPhase('appointment'); setLinkState('idle');
      } catch { setLinkError('Sorry, we could not open this booking link.'); setLinkState('error'); }
    })();
  }, [linkCart]);

  const go = useCallback((p: Phase) => { setStack((s) => [...s, phase]); setPhase(p); window.scrollTo(0, 0); }, [phase]);
  const back = () => {
    if (phase === 'details' && hold) fetch(`/api/holds?id=${hold.holdId}`, { method: 'DELETE' });
    setStack((s) => { const n = [...s]; const p = n.pop(); if (p) setPhase(p); return n; });
    window.scrollTo(0, 0);
  };

  // deep link: /book?family=physio (audience still asked first)
  const preFamily = qs.get('family');

  const step = STEP[phase];
  const progress = phase === 'audience' ? 0 : Math.min(100, (step / 6) * 100 + (phase === 'confirm' ? 0 : 0));

  if (linkState !== 'idle') return (
    <div>
      <div className="flow-head"><span className="logo">Nuffield Health</span></div>
      <div className="flow"><div className="narrow"><h1 className="title">{linkState === 'loading' ? 'Opening your booking…' : 'Booking link'}</h1>{linkState === 'error' && <><p>{linkError}</p><a className="btn primary" href="/book">Start a new booking ›</a></>}</div></div>
    </div>
  );
  return (
    <div>
      <div className="flow-head"><span className="logo">Nuffield Health</span><a href="#help">Help and support</a></div>
      {phase !== 'audience' && (
        <>
          <div className="stepper">{STEPS.map((s, i) => <span key={s} className={i + 1 < step ? 'done' : i + 1 === step ? 'cur' : ''}>{s}</span>)}</div>
          <div className="bar"><i style={{ width: `${progress}%` }} /></div>
        </>
      )}
      <div className="flow">
        {phase !== 'audience' && phase !== 'confirm' && <button className="back" onClick={back}>‹ Back</button>}
        {flash && <div className="warn" style={{ marginBottom: 16 }}>{flash}</div>}

        {phase === 'audience' && <AudienceStep onPick={(a) => { setAudience(a); go('family'); }} />}
        {phase === 'family' && <FamilyStep preFamily={preFamily} onPick={(f) => { setFamily(f); setProduct(null); if (REMOTE_FAMILIES.has(f.key)) go('format'); else { setFormat('in-person'); go('product'); } }} />}
        {phase === 'format' && <FormatStep onPick={(f) => { setFormat(f); go('product'); }} />}
        {phase === 'product' && family && <ProductStep family={family} format={format} audience={audience} onPick={(p) => { setProduct(p); go('lead'); }} />}
        {phase === 'lead' && product && <LeadStep product={product} audience={audience} onNext={() => go(format === 'remote' ? 'date' : 'location')} />}
        {phase === 'location' && <LocationStep onPick={(g) => { setGeo(g); go('date'); }} />}
        {phase === 'date' && <DateStep date={date} setDate={setDate} onNext={() => go('appointment')} />}
        {phase === 'appointment' && product && family && (
          <AppointmentStep product={product} family={family} audience={audience} format={format} geo={geo} date={date}
            onEdit={() => { setStack([]); setPhase('family'); }}
            onPick={async (c, s) => {
              try {
                setFlash(null);
                const h = await api<Hold & { slotId: string }>('/api/holds', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slotId: s.slotId }) });
                if (cartId && (s.startsAt !== cartStart || c.key !== clinic?.key)) setCartId(null);
                setClinic(c); setSlot(s); setHold(h); go('details');
              } catch { setFlash('Sorry, that appointment has just been taken. Please choose another time.'); }
            }} />
        )}
        {phase === 'details' && product && clinic && slot && hold && family && (
          <DetailsStep cartId={cartId} product={product} family={family} audience={audience} format={format} clinic={clinic} slot={slot} hold={hold}
            onExpired={() => { setFlash('Your held appointment expired. Please choose a time again.'); setHold(null); setStack((s) => s.slice(0, -1)); setPhase('appointment'); }}
            onDone={(r) => { setResult(r); setStack([]); setPhase('confirm'); window.scrollTo(0, 0); }} />
        )}
        {phase === 'confirm' && result && product && clinic && <ConfirmStep result={result} product={product} clinic={clinic} />}
      </div>
    </div>
  );
}

/* ---------- step 0 ---------- */
function AudienceStep({ onPick }: { onPick: (a: Audience) => void }) {
  return (
    <div className="narrow">
      <h1 className="title">Choose your customer type</h1>
      {AUDIENCES.map((a) => (
        <button key={a.key} className="choice" onClick={() => onPick(a.key)}><b>{a.title}</b><span>{a.blurb}</span></button>
      ))}
    </div>
  );
}

/* ---------- step 1 ---------- */
function FamilyStep({ onPick, preFamily }: { onPick: (f: Family) => void; preFamily: string | null }) {
  const [fams, setFams] = useState<Family[]>([]);
  useEffect(() => { api<{ families: Family[] }>('/api/families').then((r) => setFams(r.families)); }, []);
  useEffect(() => { const f = fams.find((x) => x.key === preFamily); if (f) onPick(f); /* eslint-disable-next-line */ }, [fams]);
  return (
    <div className="narrow">
      <h1 className="title">Pick an appointment type</h1>
      {fams.map((f) => <button key={f.key} className="choice" onClick={() => onPick(f)}><b>{f.title}</b><span>{f.blurb}</span></button>)}
    </div>
  );
}

function FormatStep({ onPick }: { onPick: (f: Format) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="narrow">
      <h1 className="title">Choose a format</h1>
      <div className="accordion" onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }}>How do remote appointments work? {open ? '▴' : '▾'}
        {open && <div className="body">We will call you or send a secure video link at your appointment time. Make sure you are somewhere quiet with a good connection.</div>}
      </div>
      <button className="choice" onClick={() => onPick('in-person')}><b>In person</b><span>Have your appointment face-to-face at a Nuffield Health site.</span></button>
      <button className="choice" onClick={() => onPick('remote')}><b>Remote</b><span>Have your appointment via telephone or video call.</span></button>
    </div>
  );
}

function ProductStep({ family, format, audience, onPick }: { family: Family; format: Format; audience: Audience; onPick: (p: Product) => void }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  useEffect(() => { api<{ products: Product[] }>(`/api/products?family=${family.key}&format=${format}&audience=${audience}`).then((r) => setProducts(r.products)); }, [family, format, audience]);
  return (
    <div className="narrow">
      <h1 className="title">Choose an appointment</h1>
      {products?.some((p) => (p.price ?? 0) > 25000) && <div className="infobox">We offer 0% finance on products over £250, so you can pay monthly at no extra cost. <b>Apply now</b> to spread the cost.</div>}
      {audience === 'insurance' && <div className="infobox">Insurance customers: some services need a referral or an insurer authorisation code. You will be asked for it later.</div>}
      {products?.map((p, i) => (
        <div key={p.sku}>
        {p.group && p.group !== products[i - 1]?.group && <h2 className="title" style={{ fontSize: 22, margin: '28px 0 10px' }}>{p.group}</h2>}
        <div className="pcard">
          {p.badge && <span className={`badge ${p.badge}`}>{p.badge}</span>}
          <div className="top"><h3>{p.name}</h3><button className="more" onClick={() => setInfo(info === p.sku ? null : p.sku)}>More information ⓘ</button></div>
          <div className="meta">{priceLabel(p, audience)}&nbsp;&nbsp;{p.durationMins} minutes{p.resultsDays ? `  ·  results in about ${p.resultsDays} days` : ''}</div>
          {audience !== 'public' && p.publicPrice != null && p.price != null && p.price < p.publicPrice && <div className="muted" style={{ fontSize: 14, marginBottom: 8 }}>Standard price <s>{gbp(p.publicPrice)}</s></div>}
          <p>{p.description}</p>
          {info === p.sku && <p className="muted">SKU {p.sku}{p.requiresReferral ? ' · referral required' : ''} · cancel free up to 72 hours before.</p>}
          <button className="btn block" onClick={() => onPick(p)}>Select</button>
        </div>
        </div>
      ))}
      {products && !products.length && <p>No appointments available for this selection.</p>}
    </div>
  );
}

function LeadStep({ product, audience, onNext }: { product: Product; audience: Audience; onNext: () => void }) {
  const [name, setName] = useState(() => pf(SAMPLE.name, '')); const [phone, setPhone] = useState(() => pf(SAMPLE.phone, ''));
  return (
    <>
      <div className="narrow">
        <h1 className="title">Enter your details</h1>
        <label className="f">Your full name</label><input className="t" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <label className="f">Your telephone number</label><input className="t" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        <p className="fine" style={{ textAlign: 'center', margin: '24px 0' }}>We will only use your details to contact you in relation to this enquiry. Your details will be handled in accordance with the Nuffield Health privacy policy.</p>
        <button className="btn primary block" onClick={onNext}>Continue</button>
        <button className="btn block" style={{ marginTop: 14 }} onClick={onNext}>Skip</button>
      </div>
      <StickyBar product={product} audience={audience} />
    </>
  );
}

/* ---------- step 2 ---------- */
function LocationStep({ onPick }: { onPick: (g: GeoResult) => void }) {
  const [q, setQ] = useState(() => pf(SAMPLE.location, '')); const [results, setResults] = useState<GeoResult[]>([]);
  const [chosen, setChosen] = useState<GeoResult | null>(null); const [err, setErr] = useState(false);
  useEffect(() => { // pre-fill: pick the first match for the sample location
    if (!pf(true, false)) return;
    api<{ results: GeoResult[] }>(`/api/geocode?q=${encodeURIComponent(SAMPLE.location)}`).then((r) => { if (r.results[0]) { setChosen(r.results[0]); setQ(r.results[0].label); setResults([]); } });
  }, []);
  useEffect(() => {
    if (chosen && q === chosen.label) return;
    const t = setTimeout(() => { if (q.trim().length > 1) api<{ results: GeoResult[] }>(`/api/geocode?q=${encodeURIComponent(q)}`).then((r) => setResults(r.results)); else setResults([]); }, 150);
    return () => clearTimeout(t);
  }, [q, chosen]);
  return (
    <div className="narrow">
      <h1 className="title">Choose a location</h1>
      <label className="f" style={{ marginBottom: 0 }}>Location</label>
      <div className="muted" style={{ marginBottom: 8 }}>Enter a city, postcode or Health Centre and select from the list</div>
      <input className={`t ${err ? 'err' : ''}`} value={q} onChange={(e) => { setQ(e.target.value); setChosen(null); setErr(false); }} autoFocus />
      {(err || (q && !chosen && results.length === 0 && q.length > 2)) && <div className="warn">Enter a city, postcode or Health Centre and select from the list</div>}
      {!chosen && results.length > 0 && (
        <div className="dropdown"><h4>Locations</h4>
          {results.map((r) => <button key={r.label} onClick={() => { setChosen(r); setQ(r.label); setResults([]); }}>📍 <span>{r.label}</span></button>)}
        </div>
      )}
      <button className="btn primary block" style={{ marginTop: 28 }} onClick={() => (chosen ? onPick(chosen) : setErr(true))}>Continue ›</button>
    </div>
  );
}

/* ---------- step 3 ---------- */
function DateStep({ date, setDate, onNext }: { date: string; setDate: (d: string) => void; onNext: () => void }) {
  return (
    <div className="narrow">
      <h1 className="title">Choose a date</h1>
      <label className="f" style={{ marginTop: 0 }}>Earliest date you can attend</label>
      <input className="t" type="date" min={todayYmd()} value={date} onChange={(e) => setDate(e.target.value)} />
      <p className="muted">We&apos;ll show you the next available appointments from this date at each site.</p>
      <button className="btn primary block" style={{ marginTop: 20 }} onClick={onNext} disabled={!date}>Continue ›</button>
    </div>
  );
}

/* ---------- step 4 ---------- */
function AppointmentStep(props: {
  product: Product; family: Family; audience: Audience; format: Format; geo: GeoResult | null; date: string;
  onEdit: () => void; onPick: (c: Clinic, s: Slot) => void;
}) {
  const { product, family, audience, format, geo, date } = props;
  const [clinics, setClinics] = useState<Clinic[] | null>(null);
  useEffect(() => {
    const u = new URLSearchParams({ sku: product.sku, audience, format, from: date, lat: String(geo?.lat ?? 0), lng: String(geo?.lng ?? 0) });
    api<{ clinics: Clinic[] }>(`/api/clinics?${u}`).then((r) => setClinics(r.clinics));
  }, [product.sku, audience, format, date, geo]);
  const where = format === 'remote' ? 'Remote' : geo?.label;
  return (
    <>
      <h1 className="title">Choose appointment</h1>
      <div className="summary-banner"><span>{family.title} - {product.name}, {fmtLong(date + 'T12:00:00Z')}, {where}</span><button onClick={props.onEdit}>Edit</button></div>
      <div className="cols">
        <div>
          <h2 style={{ fontSize: 22 }}>{clinics ? `We've got ${clinics.length} ${format === 'remote' ? 'remote option' : 'health clinic'}${clinics.length === 1 ? '' : 's'} ${format === 'remote' ? '' : 'near you'}` : 'Finding clinics…'}</h2>
          <a href="#x" style={{ textDecoration: 'none' }}>Pick a day and time at the clinic that suits you</a>
          <div className="infobox" style={{ marginTop: 16 }}>We&apos;re showing you the next available appointments at each clinic.</div>
          <div className="pills"><span>Sort by ⌄</span><span>Dr. preference ⌄</span><span>Distance ⌄</span><span>Date ⌄</span></div>
          {clinics && clinics.length > 1 && (
            <div className="carousel">
              {clinics.map((c, i) => (
                <div className="mini" key={c.key}>
                  <div><span className="n">{i + 1}</span><b>{c.name.replace('Nuffield Health ', '')}</b></div>
                  <div className="muted" style={{ fontSize: 13 }}>({c.distanceMiles} mi)</div>
                  <div style={{ fontSize: 13, margin: '10px 0' }}>First available appointment:<br /><b>{c.firstAvailable ? fmtLong(c.firstAvailable).replace(/ \d{4}$/, '') : 'None in next 60 days'}</b></div>
                  <a className="btn primary block" style={{ padding: '8px', fontSize: 14 }} href={`#clinic-${i}`}>Select</a>
                </div>
              ))}
            </div>
          )}
          {clinics?.map((c, i) => <ClinicCard key={c.key} idx={i} clinic={c} product={product} format={format} from={date} audience={audience} onPick={(s) => props.onPick(c, s)} />)}
        </div>
        {format !== 'remote' && clinics && <MapPanel clinics={clinics} origin={geo} />}
      </div>
      <StickyBar product={product} audience={audience} />
    </>
  );
}

function ClinicCard({ clinic, product, from, audience, format, idx, onPick }: { clinic: Clinic; product: Product; from: string; audience: Audience; format: Format; idx: number; onPick: (s: Slot) => void }) {
  const [days, setDays] = useState<Record<string, Slot[]> | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [off, setOff] = useState(0);
  useEffect(() => {
    api<{ days: Record<string, Slot[]> }>(`/api/availability?loc=${clinic.key}&sku=${product.sku}&from=${from}&days=42`).then((r) => { setDays(r.days); setSel(Object.keys(r.days)[0] ?? null); setOff(0); });
  }, [clinic.key, product.sku, from]);
  const keys = days ? Object.keys(days) : [];
  const shown = keys.slice(off, off + 5);
  return (
    <div className="clinic" id={`clinic-${idx}`}>
      <div>{format !== 'remote' && <span className="chip">{clinic.distanceMiles} mi</span>}</div>
      <h3>{idx + 1}. {clinic.name}</h3>
      <div className="muted">{clinic.town}{clinic.type === 'remote' ? '' : ' · ' + clinic.type.replace('-', ' ')}</div>
      {!days && <p className="muted">Loading appointments…</p>}
      {days && !keys.length && <p className="warn">No appointments in the next 6 weeks.</p>}
      {days && keys.length > 0 && (
        <>
          <div className="strip">
            <button className="arrow" disabled={off === 0} onClick={() => setOff(Math.max(0, off - 5))}>‹</button>
            {shown.map((k) => {
              const d = fmtDay(k);
              return (
                <button key={k} className={`day ${sel === k ? 'sel' : ''}`} onClick={() => setSel(k)}>
                  {d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}<br /><b>{d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</b><u />
                </button>
              );
            })}
            <button className="arrow" disabled={off + 5 >= keys.length} onClick={() => setOff(off + 5)}>›</button>
          </div>
          {sel && <>
            <div style={{ marginBottom: 10 }}>Available slots on {fmtLong(sel + 'T12:00:00Z')}</div>
            <div className="slots">{days[sel].map((s) => <button key={s.slotId} onClick={() => onPick(s)}>{fmtTime(s.startsAt)}</button>)}</div>
          </>}
        </>
      )}
    </div>
  );
}

/** Placeholder map. Swap for Mapbox/Leaflet; pins are numbered like the result list. */
function MapPanel({ clinics, origin }: { clinics: Clinic[]; origin: GeoResult | null }) {
  const pts = [...clinics.map((c) => ({ lat: c.lat, lng: c.lng })), ...(origin ? [origin] : [])];
  const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
  const minLa = Math.min(...lats), maxLa = Math.max(...lats), minLn = Math.min(...lngs), maxLn = Math.max(...lngs);
  const W = 440, H = 520, P = 40;
  const k = Math.cos((((minLa + maxLa) / 2) * Math.PI) / 180);
  const sx = (maxLn - minLn) * k || 0.01, sy = maxLa - minLa || 0.01;
  const scale = Math.min((W - 2 * P) / sx, (H - 2 * P) / sy);
  const X = (ln: number) => W / 2 + (ln - (minLn + maxLn) / 2) * k * scale;
  const Y = (la: number) => H / 2 - (la - (minLa + maxLa) / 2) * scale;
  return (
    <div className="map"><svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Map of clinics">
      <rect width={W} height={H} fill="#e7efe9" />
      {origin && <g><circle cx={X(origin.lng)} cy={Y(origin.lat)} r="9" fill="#2563eb" stroke="#fff" strokeWidth="3" /><text x={X(origin.lng) + 14} y={Y(origin.lat) + 4} fontSize="12" fill="#1e3a8a">You</text></g>}
      {clinics.map((c, i) => (
        <a key={c.key} href={`#clinic-${i}`}><g><path d={`M${X(c.lng)} ${Y(c.lat)} l-9 -22 a11 11 0 1 1 18 0z`} fill="#d6302b" /><text x={X(c.lng)} y={Y(c.lat) - 22} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">{i + 1}</text></g></a>
      ))}
    </svg></div>
  );
}

/* ---------- step 5 ---------- */
function useCountdown(expiresAt: string, onExpired: () => void) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));
  const cb = useRef(onExpired); cb.current = onExpired;
  useEffect(() => {
    const t = setInterval(() => { const l = new Date(expiresAt).getTime() - Date.now(); setLeft(Math.max(0, l)); if (l <= 0) { clearInterval(t); cb.current(); } }, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function DetailsStep({ cartId, product, family, audience, format, clinic, slot, hold, onExpired, onDone }: {
  cartId: string | null;
  product: Product; family: Family; audience: Audience; format: Format; clinic: Clinic; slot: Slot; hold: Hold; onExpired: () => void; onDone: (r: Result) => void;
}) {
  const left = useCountdown(hold.expiresAt, onExpired);
  const [priced, setPriced] = useState<Product>(product);
  useEffect(() => {
    api<{ products: Product[] }>(`/api/products?family=${product.family}&format=${format}&audience=${audience}&region=${clinic.pricingRegion}`)
      .then((r) => { const p = r.products.find((x) => x.sku === product.sku); if (p) setPriced({ ...p, priceFrom: false }); });
  }, [product, format, audience, clinic.pricingRegion]);

  const [f, setF] = useState<Record<string, string>>(() => pf({ title: SAMPLE.title, first: SAMPLE.first, last: SAMPLE.last, dob: SAMPLE.dob, sex: SAMPLE.sex, postcode: SAMPLE.postcode, address: SAMPLE.address, email: SAMPLE.email, email2: SAMPLE.email, phone: SAMPLE.phone, manual: '' }, { title: '', first: '', last: '', dob: '', sex: '', postcode: '', address: '', email: '', email2: '', phone: '', manual: '' }));
  const [fund, setFund] = useState<Record<string, string>>(() => pf({ insurer: SAMPLE.insurer, policy: SAMPLE.policy, authCode: SAMPLE.authCode, membership: SAMPLE.membership, company: SAMPLE.company }, { insurer: '', policy: '', authCode: '', membership: '', company: '' }));
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [personalDone, setPersonalDone] = useState(false);
  const [addrOpts, setAddrOpts] = useState<string[]>(() => pf([1, 2, 3, 4].map((n) => `${n} Sample Street, ${SAMPLE.postcode}`), []));
  const [manual, setManual] = useState(false);
  const [card, setCard] = useState(() => pf({ ...SAMPLE.card }, { name: '', number: '', expiry: '', cvc: '' }));
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const setFu = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFund((s) => ({ ...s, [k]: e.target.value }));

  const needsCard = audience !== 'business';
  const lookup = () => { const pc = f.postcode.trim().toUpperCase(); setAddrOpts(pc ? [1, 2, 3, 4].map((n) => `${n} Sample Street, ${pc}`) : []); };

  const validatePersonal = () => {
    const e: Record<string, boolean> = {};
    (['title', 'first', 'last', 'sex', 'postcode', 'phone'] as const).forEach((k) => { if (!f[k].trim()) e[k] = true; });
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(f.dob)) e.dob = true;
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = true;
    if (f.email !== f.email2) e.email2 = true;
    if (!(manual ? f.manual.trim() : f.address)) e.address = true;
    if (audience === 'insurance' && (!fund.insurer || !fund.policy.trim())) e.insurer = true;
    if (audience === 'gym' && !fund.membership.trim()) e.membership = true;
    if (audience === 'business' && !fund.company.trim()) e.company = true;
    setErrors(e);
    if (!Object.keys(e).length) setPersonalDone(true);
  };

  const confirmCard = () => {
    const digits = card.number.replace(/\s/g, '');
    if (!card.name.trim() || digits.length < 12 || !card.expiry || card.cvc.length < 3) { setErr('Please complete your card details.'); return; }
    setErr(null);
    // Card data never leaves the browser in this demo. Real build: PSP hosted fields -> SetupIntent token.
    setToken('tok_mock_' + Math.random().toString(36).slice(2, 10));
    setCard({ name: card.name, number: '•••• •••• •••• ' + digits.slice(-4), expiry: card.expiry, cvc: '' });
  };

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api<{ booking: Result }>('/api/bookings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          holdId: hold.holdId, sku: product.sku, locationKey: clinic.key, startsAt: slot.startsAt, audience, paymentToken: token,
          patient: { ...f, address: manual ? f.manual : f.address }, funding: relevantFunding(audience, fund), cartId,
        }),
      });
      onDone({ reference: r.booking.reference, startsAt: slot.startsAt });
    } catch (e: any) {
      setErr(e.status === 410 ? 'Your hold has expired. Please pick a time again.' : 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };

  const cls = (k: string) => `t ${errors[k] ? 'err' : ''}`;
  return (
    <>
      <h1 className="title">Enter your details</h1>
      <div className="cols">
        <div>
          <div className="panel"><h3>1. Your personal details <span>{personalDone ? '✓' : '—'}</span></h3>
            {!personalDone ? (
              <div className="in">
                <label className="f">Title</label>
                <select className={cls('title')} value={f.title} onChange={set('title')} style={{ maxWidth: 200 }}><option value=""></option>{['Mr', 'Mrs', 'Ms', 'Miss', 'Mx', 'Dr'].map((t) => <option key={t}>{t}</option>)}</select>
                <div className="two"><div><label className="f">First name</label><input className={cls('first')} value={f.first} onChange={set('first')} /></div>
                  <div><label className="f">Last name</label><input className={cls('last')} value={f.last} onChange={set('last')} /></div></div>
                <label className="f">Date of birth</label><input className={cls('dob')} placeholder="DD/MM/YYYY" value={f.dob} onChange={set('dob')} />
                <label className="f">Sex at birth†</label>
                <div className="radios">{['Male', 'Female'].map((s) => <label key={s} className={f.sex === s ? 'on' : ''}><input type="radio" name="sex" checked={f.sex === s} onChange={() => setF((x) => ({ ...x, sex: s }))} /> {s}</label>)}</div>
                <label className="f">Postcode</label>
                <div style={{ display: 'flex', gap: 10 }}><input className={cls('postcode')} value={f.postcode} onChange={set('postcode')} /><button className="btn" style={{ margin: 0, whiteSpace: 'nowrap' }} onClick={lookup}>Find address</button></div>
                <p><a href="#m" onClick={(e) => { e.preventDefault(); setManual(!manual); }}>{manual ? 'Choose from list' : 'Enter address manually'}</a></p>
                <label className="f">Address</label>
                {manual ? <input className={cls('address')} value={f.manual} onChange={set('manual')} placeholder="House number, street, town" />
                  : <select className={cls('address')} value={f.address} onChange={set('address')}><option value="">{addrOpts.length ? 'Select your address' : 'Enter postcode and Find address'}</option>{addrOpts.map((a) => <option key={a}>{a}</option>)}</select>}
                <label className="f">Email address</label><input className={cls('email')} type="email" value={f.email} onChange={set('email')} />
                <label className="f">Confirm email address</label><input className={cls('email2')} type="email" value={f.email2} onChange={set('email2')} />
                <label className="f">Phone number</label><input className={cls('phone')} type="tel" value={f.phone} onChange={set('phone')} />

                {audience === 'insurance' && <>
                  <label className="f">Insurer</label><select className={cls('insurer')} value={fund.insurer} onChange={setFu('insurer')}><option value="">Select your insurer</option>{INSURERS.map((i) => <option key={i}>{i}</option>)}</select>
                  <label className="f">Policy or membership number</label><input className={cls('insurer')} value={fund.policy} onChange={setFu('policy')} />
                  <label className="f">Authorisation code (if you have one)</label><input className="t" value={fund.authCode} onChange={setFu('authCode')} />
                  <p className="fine">If you don&apos;t have an authorisation code yet, we&apos;ll contact you before your appointment. You may have to pay any policy excess.</p></>}
                {audience === 'gym' && <><label className="f">Nuffield Health membership number</label><input className={cls('membership')} value={fund.membership} onChange={setFu('membership')} /></>}
                {audience === 'business' && <><label className="f">Company name or code</label><input className={cls('company')} value={fund.company} onChange={setFu('company')} /></>}

                {Object.keys(errors).length > 0 && <div className="warn">Please complete the highlighted fields.</div>}
                <button className="btn primary block" style={{ marginTop: 28 }} onClick={validatePersonal}>Continue</button>
                <p className="fine">Please see the Nuffield Health privacy policy for how we collect, use and protect your data. To opt out of marketing, contact us at any time.</p>
                <p className="fine">† This question helps us offer and interpret appropriate individual tests that may be needed during your appointment.</p>
              </div>
            ) : <div className="in"><b>{f.title} {f.first} {f.last}</b><br />{f.email} · {f.phone} <button className="more" style={{ background: 'none', border: 0, color: 'var(--brand)', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => { setPersonalDone(false); }}>Edit</button></div>}
          </div>

          {personalDone && (
            <div className="panel"><h3>2. Your payment details <span>—</span></h3>
              <div className="in">
                {needsCard ? <>
                  <div className="accordion" style={{ background: 'var(--soft)', padding: 20 }}>
                    <div style={{ fontSize: 18, marginBottom: 6 }}>Why do we need your card details?</div>
                    <div className="body" style={{ fontWeight: 400 }}>You won&apos;t be charged now, but we store card details as you may still be charged if you don&apos;t attend or cancel late. Full payment is taken on the day of your appointment.{audience === 'insurance' ? ' Insured customers are only charged any excess or uncovered amount.' : ''}</div>
                  </div>
                  <h3 style={{ marginTop: 22, fontSize: 18 }}>Billing address</h3>
                  <p className="muted" style={{ margin: 0 }}>Where your card is registered to</p>
                  <p style={{ fontSize: 18 }}>{manual ? f.manual : f.address}</p>
                  <button className="btn block" onClick={() => setPersonalDone(false)}>Update billing address</button>
                </> : <div className="accordion"><div style={{ fontSize: 18 }}>No payment needed</div><div className="body" style={{ fontWeight: 400 }}>Your appointment is paid for by your employer ({fund.company}). Nothing will be charged to you.</div></div>}
                <div className="total"><span>Total</span><span>{audience === 'business' ? '£0.00' : priceLabel(priced, audience).replace('from ', '')}</span></div>
                {needsCard && !token && (
                  <div className="cardform">
                    <h3 style={{ fontFamily: 'Georgia, serif', fontWeight: 600 }}>Your card details <span className="tag">demo – nothing is sent or stored</span></h3>
                    <div className="row"><span>Name:</span><input placeholder="Cardholder Name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} autoComplete="off" /></div>
                    <div className="row"><span>Card:</span><input placeholder="0000 0000 0000 0000" inputMode="numeric" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} autoComplete="off" /></div>
                    <div className="row"><span>Expiry:</span><input placeholder="MMYY" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} autoComplete="off" /></div>
                    <div className="row"><span>CVC:</span><input placeholder="123" inputMode="numeric" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} autoComplete="off" /></div>
                    <div style={{ textAlign: 'center', margin: '16px 0' }}><button className="btn green" onClick={confirmCard}>Confirm card details</button></div>
                  </div>
                )}
                {needsCard && token && <p>✓ Card saved: {card.number} <a href="#c" onClick={(e) => { e.preventDefault(); setToken(null); setCard({ name: '', number: '', expiry: '', cvc: '' }); }}>change</a></p>}
                {err && <div className="warn">{err}</div>}
                <h3 style={{ marginTop: 22, fontSize: 18 }}>Booking</h3>
                <p className="fine">Booking is subject to our <a href="#t">terms and conditions</a>. By confirming your appointment you confirm that you have read and agree to these terms and conditions. Free changes or cancellation up to 72 hours before; a £75 charge may apply inside 72 hours.</p>
                <button className="btn primary block" disabled={busy || (needsCard && !token)} onClick={submit}>{busy ? 'Booking…' : 'Confirm booking'}</button>
              </div>
            </div>
          )}
        </div>
        <div>
          <div className="summary-card"><h3>What you have selected</h3>
            <div style={{ fontWeight: 600 }}>You have chosen</div>
            <div>{family.title} - {product.name}</div>
            <div>{fmtTime(slot.startsAt)} on {fmtLong(slot.startsAt)}</div>
            <div className="muted">{clinic.name}{format === 'remote' ? '' : `, ${clinic.town}`}</div>
            <div style={{ marginTop: 10 }} className="muted">Held for you for <b>{left}</b></div>
          </div>
          <div className="accordion">What if you need to cancel your appointment?<div className="body">Free to change or cancel up to 72 hours before. A charge of £75 may apply inside 72 hours.</div></div>
          <div className="accordion">What to know before your appointment<div className="body">Arrive 10 minutes early. Bring photo ID{audience === 'insurance' ? ', your insurance details' : ''}{audience === 'gym' ? ' and your membership card' : ''}. We&apos;ll email preparation tips straight after booking.</div></div>
          <p className="muted">If you have any other questions, please <a href="#faq">check our FAQs</a>.</p>
        </div>
      </div>
      <StickyBar product={priced} audience={audience} />
    </>
  );
}

/* ---------- step 6 ---------- */
function ConfirmStep({ result, product, clinic }: { result: Result; product: Product; clinic: Clinic }) {
  const ics = useMemo(() => {
    const dt = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const end = new Date(new Date(result.startsAt).getTime() + product.durationMins * 60000).toISOString();
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', `UID:${result.reference}@nuffield-demo`, `DTSTART:${dt(result.startsAt)}`, `DTEND:${dt(end)}`, `SUMMARY:${product.name} - Nuffield Health`, `LOCATION:${clinic.name}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return 'data:text/calendar;charset=utf8,' + encodeURIComponent(body);
  }, [result, product, clinic]);
  return (
    <div className="narrow">
      <h1 className="title">Your appointment is confirmed</h1>
      <div className="ok">
        <p style={{ margin: 0 }}>Booking reference</p>
        <h2 style={{ fontSize: 32, margin: '4px 0 16px' }}>{result.reference}</h2>
        <p><b>{product.name}</b><br />{fmtTime(result.startsAt)} on {fmtLong(result.startsAt)}<br />{clinic.name}</p>
        <a className="btn primary" href={ics} download={`${result.reference}.ics`}>Add to calendar</a>
        <a className="btn" href="/book">Book another</a>
      </div>
      <p className="fine">We&apos;ve emailed your confirmation with preparation tips. You can change or cancel free of charge up to 72 hours before your appointment.</p>
    </div>
  );
}

function StickyBar({ product, audience }: { product: Product; audience: Audience }) {
  return (
    <div className="sticky"><div className="wrap">
      <span>What you have selected<small>{product.name}</small></span><span>{audience === 'business' ? 'Paid by employer' : priceLabel(product, audience)}</span>
    </div></div>
  );
}
