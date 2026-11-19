'use client';
import { useState, type FormEvent } from 'react';
export default function Gate() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr(false);
    const next = new URLSearchParams(window.location.search).get('next') ?? '/';
    const r = await fetch('/api/gate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw, next }) });
    if (r.ok) { const j = await r.json(); window.location.href = j.next || '/'; } else { setErr(true); setBusy(false); }
  }
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', background: '#f5f7f9' }}>
      <form onSubmit={submit} style={{ background: '#fff', padding: 32, borderRadius: 12, width: 340, boxShadow: '0 2px 12px rgba(0,0,0,.08)' }}>
        <h1 style={{ fontSize: 20, margin: '0 0 6px' }}>Nuffield Health booking demo</h1>
        <p style={{ margin: '0 0 18px', color: '#555', fontSize: 14 }}>Enter the password to continue.</p>
        <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password" style={{ width: '100%', padding: 10, fontSize: 16, boxSizing: 'border-box', border: '1px solid #bbb', borderRadius: 6 }} />
        {err && <p role="alert" style={{ color: '#b00020', fontSize: 14, margin: '10px 0 0' }}>Incorrect password.</p>}
        <button type="submit" disabled={busy || !pw} style={{ marginTop: 16, width: '100%', padding: 11, fontSize: 16, border: 0, borderRadius: 6, background: '#005a3c', color: '#fff', cursor: 'pointer' }}>Continue</button>
      </form>
    </main>
  );
}
