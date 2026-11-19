import { useHistory } from 'react-router-dom';
import SelectInput from '@commercetools-uikit/select-input';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import { useCalendarApi } from '../../hooks/use-calendar-api';
import { useQueryState } from '../../hooks/use-query-state';
import type { HeatRow, Service } from '../../types';
import {
  Async,
  Legend,
  addDays,
  heat,
  selectOptions,
  shortDay,
  todayYmd,
} from '../common';

const Heatmap = ({ basePath }: { basePath: string }) => {
  const { get, set } = useQueryState();
  const history = useHistory();
  const services = useCalendarApi<{ services: Service[] }>(
    '/api/admin/services'
  );
  const sku = get('sku') ?? services.data?.services[0]?.sku;
  const from = get('from') ?? todayYmd();
  const map = useCalendarApi<{ dates: string[]; rows: HeatRow[] }>(
    sku ? `/api/admin/heatmap?sku=${sku}&from=${from}&days=14` : null
  );
  const rows = map.data?.rows ?? [];
  const dates = map.data?.dates ?? [];
  return (
    <Spacings.Stack scale="l">
      <Text.Headline as="h2">Availability heatmap</Text.Headline>
      <Text.Body>
        Utilisation of the next 14 days across every location offering the
        selected service. Click a cell to open that location&apos;s calendar.
      </Text.Body>
      <Spacings.Inline scale="m" alignItems="flex-end">
        <div style={{ width: 380 }}>
          <Text.Detail>Service</Text.Detail>
          <SelectInput
            name="sku"
            value={sku ?? ''}
            options={selectOptions(
              services.data?.services ?? [],
              (s) => s.sku,
              (s) => s.name
            )}
            onChange={(e) => set({ sku: e.target.value as string })}
          />
        </div>
        <SecondaryButton
          label="‹ Earlier"
          onClick={() => set({ from: addDays(from, -14) })}
        />
        <SecondaryButton
          label="Today"
          onClick={() => set({ from: undefined })}
        />
        <SecondaryButton
          label="Later ›"
          onClick={() => set({ from: addDays(from, 14) })}
        />
      </Spacings.Inline>
      <Async
        loading={services.loading || map.loading}
        error={services.error ?? map.error}
      >
        <Legend />
        {rows.length > 0 && (
          <div style={{ overflow: 'auto', maxHeight: '65vh' }}>
            <table
              style={{
                borderCollapse: 'separate',
                borderSpacing: 2,
                fontSize: 12,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      background: '#fff',
                      textAlign: 'left',
                      minWidth: 260,
                    }}
                  >
                    Location ({rows.length})
                  </th>
                  {dates.map((d) => (
                    <th
                      key={d}
                      style={{
                        position: 'sticky',
                        top: 0,
                        background: '#fff',
                        fontWeight: 500,
                        minWidth: 54,
                      }}
                    >
                      {shortDay(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.name.replace('Nuffield Health ', '')}</td>
                    {r.days.map((d) => {
                      const { bg, fg } = heat(d.used, d.capacity);
                      return (
                        <td
                          key={d.date}
                          title={
                            d.capacity
                              ? `${d.free} of ${d.capacity} free`
                              : 'Closed'
                          }
                          onClick={() =>
                            d.capacity &&
                            history.push(
                              `${basePath}/calendar?loc=${r.key}&sku=${sku}&from=${d.date}`
                            )
                          }
                          style={{
                            background: bg,
                            color: fg,
                            textAlign: 'center',
                            padding: '5px 2px',
                            borderRadius: 3,
                            cursor: d.capacity ? 'pointer' : 'default',
                          }}
                        >
                          {d.capacity
                            ? `${Math.round((100 * d.used) / d.capacity)}%`
                            : '–'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Async>
    </Spacings.Stack>
  );
};
Heatmap.displayName = 'Heatmap';
export default Heatmap;
