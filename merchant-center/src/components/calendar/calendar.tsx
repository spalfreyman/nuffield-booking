import { useMemo, useState } from 'react';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import SelectInput from '@commercetools-uikit/select-input';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import { useCalendarApi } from '../../hooks/use-calendar-api';
import { useInventory, useLocations } from '../../hooks/use-locations';
import { useQueryState } from '../../hooks/use-query-state';
import type { AdminBooking, CalendarDay, GridCell, Service } from '../../types';
import {
  Async,
  Legend,
  addDays,
  dayLabel,
  heat,
  mondayOf,
  selectOptions,
  timeLabel,
  todayYmd,
} from '../common';

const Calendar = () => {
  const { get, set } = useQueryState();
  const projectKey = useApplicationContext((c) => c.project?.key);
  const { locations, loading: l1, error: e1 } = useLocations();
  const inv = useInventory();
  const services = useCalendarApi<{ services: Service[] }>(
    '/api/admin/services'
  );

  const loc = get('loc') ?? locations[0]?.key;
  const offered = useMemo(
    () =>
      new Set(
        inv.entries.filter((e) => e.channelKey === loc).map((e) => e.sku)
      ),
    [inv.entries, loc]
  );
  const svcList = (services.data?.services ?? []).filter(
    (s) => !loc || offered.size === 0 || offered.has(s.sku)
  );
  const sku =
    get('sku') && svcList.some((s) => s.sku === get('sku'))
      ? get('sku')!
      : svcList[0]?.sku;
  const from = mondayOf(get('from') ?? todayYmd());
  const [sel, setSel] = useState<{ date: string; cell: GridCell } | null>(null);

  const cal = useCalendarApi<{ days: CalendarDay[] }>(
    loc && sku
      ? `/api/admin/calendar?loc=${loc}&sku=${sku}&from=${from}&days=7`
      : null
  );
  const bookings = useCalendarApi<{ bookings: AdminBooking[] }>(
    loc && sku ? `/api/admin/bookings?loc=${loc}&sku=${sku}` : null
  );

  const days = useMemo(() => cal.data?.days ?? [], [cal.data]);
  const labels = useMemo(
    () =>
      Array.from(
        new Set(days.flatMap((d) => d.cells.map((c) => timeLabel(c.startsAt))))
      ).sort(),
    [days]
  );
  const cellAt = (d: CalendarDay, label: string) =>
    d.cells.find((c) => timeLabel(c.startsAt) === label);
  const total = days.reduce(
    (a, d) => ({ cap: a.cap + d.capacity, used: a.used + d.used }),
    { cap: 0, used: 0 }
  );
  const slotBookings = sel
    ? (bookings.data?.bookings ?? []).filter(
        (b) => b.startsAt === sel.cell.startsAt
      )
    : [];

  return (
    <Spacings.Stack scale="l">
      <Text.Headline as="h2">Calendar</Text.Headline>
      <Spacings.Inline scale="m" alignItems="flex-end">
        <div style={{ width: 340 }}>
          <Text.Detail>Location</Text.Detail>
          <SelectInput
            name="loc"
            value={loc ?? ''}
            options={selectOptions(
              locations,
              (l) => l.key,
              (l) => l.name
            )}
            onChange={(e) => {
              set({ loc: e.target.value as string });
              setSel(null);
            }}
          />
        </div>
        <div style={{ width: 340 }}>
          <Text.Detail>Service</Text.Detail>
          <SelectInput
            name="sku"
            value={sku ?? ''}
            options={selectOptions(
              svcList,
              (s) => s.sku,
              (s) => `${s.name} (${s.durationMins} min)`
            )}
            onChange={(e) => {
              set({ sku: e.target.value as string });
              setSel(null);
            }}
          />
        </div>
        <SecondaryButton
          label="‹ Previous week"
          onClick={() => set({ from: addDays(from, -7) })}
        />
        <SecondaryButton
          label="Today"
          onClick={() => set({ from: undefined })}
        />
        <SecondaryButton
          label="Next week ›"
          onClick={() => set({ from: addDays(from, 7) })}
        />
      </Spacings.Inline>
      <Async
        loading={l1 || inv.loading || services.loading || cal.loading}
        error={e1?.message ?? inv.error?.message ?? services.error ?? cal.error}
      >
        <Spacings.Inline justifyContent="space-between" alignItems="center">
          <Text.Detail>
            Week of {dayLabel(from)} ·{' '}
            {total.cap ? Math.round((100 * total.used) / total.cap) : 0}% of
            capacity used · numbers show free / total
          </Text.Detail>
          <Legend />
        </Spacings.Inline>
        {days.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                borderCollapse: 'separate',
                borderSpacing: 3,
                minWidth: 760,
                width: '100%',
              }}
            >
              <thead>
                <tr>
                  <th />
                  {days.map((d) => (
                    <th key={d.date} style={{ fontWeight: 600, fontSize: 13 }}>
                      {dayLabel(d.date)}
                      <div style={{ fontWeight: 400, fontSize: 11 }}>
                        {d.capacity ? `${d.free} free` : 'Closed'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {labels.map((label) => (
                  <tr key={label}>
                    <td
                      style={{
                        fontSize: 12,
                        textAlign: 'right',
                        paddingRight: 8,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </td>
                    {days.map((d) => {
                      const c = cellAt(d, label);
                      if (!c)
                        return (
                          <td
                            key={d.date}
                            style={{ background: '#f1f1f1', borderRadius: 3 }}
                          />
                        );
                      const { bg, fg } = heat(c.capacity - c.free, c.capacity);
                      const active = sel?.cell.startsAt === c.startsAt;
                      return (
                        <td
                          key={d.date}
                          onClick={() => setSel({ date: d.date, cell: c })}
                          title={`${c.free} free, ${c.held} held, ${c.booked} booked, ${c.busy} other bookings`}
                          style={{
                            background: bg,
                            color: fg,
                            textAlign: 'center',
                            fontSize: 12,
                            padding: '6px 2px',
                            borderRadius: 3,
                            cursor: 'pointer',
                            outline: active ? '2px solid #00569c' : undefined,
                          }}
                        >
                          {c.free}/{c.capacity}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!cal.loading && days.length > 0 && labels.length === 0 && (
          <Text.Body>No opening hours this week for this service.</Text.Body>
        )}
        {sel && (
          <div
            style={{ border: '1px solid #ddd', borderRadius: 6, padding: 16 }}
          >
            <Spacings.Stack scale="s">
              <Text.Subheadline as="h4">
                {dayLabel(sel.date)} at {timeLabel(sel.cell.startsAt)}–
                {timeLabel(sel.cell.endsAt)}
              </Text.Subheadline>
              <Text.Body>
                {sel.cell.free} free of {sel.cell.capacity} · {sel.cell.held}{' '}
                held in checkout · {sel.cell.booked} booked via the storefront ·{' '}
                {sel.cell.busy} booked in the calendar system
              </Text.Body>
              {slotBookings.length === 0 && (
                <Text.Detail>No storefront bookings for this slot.</Text.Detail>
              )}
              {slotBookings.map((b) => (
                <Text.Body key={b.reference}>
                  {b.reference} · {b.audience} · {b.status}
                  {b.orderId && projectKey && (
                    <>
                      {' '}
                      ·{' '}
                      <a href={`/${projectKey}/orders/${b.orderId}`}>
                        View order
                      </a>
                    </>
                  )}
                </Text.Body>
              ))}
            </Spacings.Stack>
          </div>
        )}
      </Async>
    </Spacings.Stack>
  );
};
Calendar.displayName = 'Calendar';
export default Calendar;
