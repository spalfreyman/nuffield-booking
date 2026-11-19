import { useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import DataTable from '@commercetools-uikit/data-table';
import SelectInput from '@commercetools-uikit/select-input';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import { useInventory, useLocations } from '../../hooks/use-locations';
import { useQueryState } from '../../hooks/use-query-state';
import { Async } from '../common';

const TYPE_LABEL: Record<string, string> = {
  hospital: 'Hospital',
  'diagnostic-suite': 'Diagnostic suite',
  'medical-centre': 'Medical centre',
  gym: 'Gym',
  remote: 'Remote',
};
const columns = [
  { key: 'name', label: 'Location', isSortable: false },
  { key: 'type', label: 'Type' },
  { key: 'town', label: 'Town' },
  { key: 'region', label: 'Region' },
  { key: 'services', label: 'Services offered' },
  { key: 'key', label: 'Channel key' },
];

const Locations = ({ basePath }: { basePath: string }) => {
  const { locations, loading, error } = useLocations();
  const inv = useInventory();
  const { get, set } = useQueryState();
  const history = useHistory();
  const type = get('type') ?? '';
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    inv.entries.forEach((e) =>
      m.set(e.channelKey, (m.get(e.channelKey) ?? 0) + 1)
    );
    return m;
  }, [inv.entries]);
  const rows = locations
    .filter((l) => !type || l.locationType === type)
    .map((l) => ({
      id: l.key,
      name: l.name,
      type: TYPE_LABEL[l.locationType] ?? l.locationType,
      town: l.town,
      region: l.region,
      services: counts.get(l.key) ?? 0,
      key: l.key,
    }));
  const types = Array.from(new Set(locations.map((l) => l.locationType)));
  return (
    <Spacings.Stack scale="l">
      <Text.Headline as="h2">Locations</Text.Headline>
      <Text.Body>
        Points of service (commercetools channels). Select a location to review
        its calendar.
      </Text.Body>
      <div style={{ maxWidth: 320 }}>
        <SelectInput
          name="type"
          value={type}
          placeholder="All location types"
          isClearable
          options={types.map((t) => ({ value: t, label: TYPE_LABEL[t] ?? t }))}
          onChange={(e) =>
            set({ type: (e.target.value as string) || undefined })
          }
        />
      </div>
      <Async
        loading={loading || inv.loading}
        error={error?.message ?? inv.error?.message}
      >
        <Text.Detail>{rows.length} locations</Text.Detail>
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={(row) =>
            history.push(`${basePath}/calendar?loc=${String(row.id)}`)
          }
        />
      </Async>
    </Spacings.Stack>
  );
};
Locations.displayName = 'Locations';
export default Locations;
