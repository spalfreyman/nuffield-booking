import type { ReactNode } from 'react';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { ContentNotification } from '@commercetools-uikit/notifications';
import Text from '@commercetools-uikit/text';

export const TZ = 'Europe/London';
export const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(new Date(iso));
export const dayLabel = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
export const shortDay = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
export const todayYmd = () => new Date().toISOString().slice(0, 10);
export const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const mondayOf = (ymd: string) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(ymd, -dow);
};

/** Green (plenty free) -> red (fully used). */
export const heat = (used: number, capacity: number) => {
  if (!capacity) return { bg: '#f1f1f1', fg: '#999' };
  const pct = used / capacity;
  return {
    bg: `hsl(${Math.round(125 * (1 - pct))} 55% ${pct > 0.85 ? 70 : 82}%)`,
    fg: '#1a1a1a',
  };
};

export const Legend = () => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
    <span>Free</span>
    {[0, 0.25, 0.5, 0.75, 1].map((p) => (
      <span
        key={p}
        style={{
          width: 28,
          height: 14,
          background: heat(p * 100, 100).bg,
          border: '1px solid #ddd',
        }}
      />
    ))}
    <span>Fully used</span>
    <span
      style={{
        marginLeft: 12,
        width: 28,
        height: 14,
        background: '#f1f1f1',
        border: '1px solid #ddd',
      }}
    />{' '}
    <span>Closed</span>
  </div>
);

export const Async = ({
  loading,
  error,
  children,
}: {
  loading?: boolean;
  error?: string;
  children: ReactNode;
}) => (
  <>
    {error && (
      <ContentNotification type="error">
        <Text.Body>{error}</Text.Body>
      </ContentNotification>
    )}
    {loading && <LoadingSpinner />}
    {!error && children}
  </>
);

export const selectOptions = <T,>(
  items: T[],
  value: (t: T) => string,
  label: (t: T) => string
) => items.map((i) => ({ value: value(i), label: label(i) }));
