'use client';
import { useEffect, useState } from 'react';
import { prefillOn, setPrefill } from '@/lib/prefill';

export default function PrefillToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(prefillOn()); }, []);
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 0', cursor: 'pointer', fontSize: 15 }}>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => { setOn(e.target.checked); setPrefill(e.target.checked); }} style={{ width: 20, height: 20 }} />
      <span><b>Pre-fill forms with sample data</b><br /><small className="muted">Demo helper: fills every form on the following pages with a sample patient.</small></span>
    </label>
  );
}
