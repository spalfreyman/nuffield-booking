const TZ = 'Europe/London';
/** "Mon 30 Nov 2026, 12:00–12:40 (UK time)" – the appointment as a person reads it. */
export function appointmentLabel(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt), e = new Date(endsAt);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(s).replace(',', '');
  const t = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${day}, ${t(s)}–${t(e)} (UK time)`;
}
