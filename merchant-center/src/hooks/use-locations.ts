import { useMcQuery } from '@commercetools-frontend/application-shell';
import { GRAPHQL_TARGETS } from '@commercetools-frontend/constants';
import type { InventoryEntry, Location } from '../types';
import LocationsQuery from '../graphql/locations.ctp.graphql';
import InventoryQuery from '../graphql/inventory.ctp.graphql';

type ChannelsData = {
  channels: {
    results: {
      id: string;
      key: string;
      nameAllLocales?: { locale: string; value: string }[];
      custom?: { customFieldsRaw?: { name: string; value: string }[] } | null;
    }[];
  };
};
type Channel = ChannelsData['channels']['results'][number];
type InventoryData = {
  inventoryEntries: {
    total: number;
    results: {
      id: string;
      version: number;
      key?: string;
      sku: string;
      supplyChannel?: { key: string } | null;
    }[];
  };
};

const ctx = { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM };

export const useLocations = () => {
  const { data, error, loading } = useMcQuery<ChannelsData>(LocationsQuery, {
    context: ctx,
  });
  const locations: Location[] = (data?.channels?.results ?? ([] as Channel[]))
    .map((c: Channel) => {
      const f: Record<string, string> = Object.fromEntries(
        (c.custom?.customFieldsRaw ?? []).map(
          (x: { name: string; value: string }) => [x.name, x.value]
        )
      );
      return {
        id: c.id,
        key: c.key,
        name:
          (
            c.nameAllLocales?.find(
              (n: { locale: string }) => n.locale === 'en-GB'
            ) ?? c.nameAllLocales?.[0]
          )?.value ?? c.key,
        locationType: f.locationType,
        town: f.town,
        region: f.region,
      };
    })
    .filter((l: Location) => l.locationType)
    .sort((a: Location, b: Location) => a.name.localeCompare(b.name));
  return { locations, error, loading };
};

export const useInventory = () => {
  const first = useMcQuery<InventoryData>(InventoryQuery, {
    variables: { limit: 500, offset: 0 },
    context: ctx,
  });
  const total = first.data?.inventoryEntries?.total ?? 0;
  const second = useMcQuery<InventoryData>(InventoryQuery, {
    variables: { limit: 500, offset: 500 },
    context: ctx,
    skip: total <= 500,
  });
  const raw = [
    ...(first.data?.inventoryEntries?.results ?? []),
    ...(second.data?.inventoryEntries?.results ?? []),
  ];
  const entries: InventoryEntry[] = raw
    .filter((e) => e.supplyChannel)
    .map((e) => ({
      id: e.id,
      version: e.version,
      key: e.key,
      sku: e.sku,
      channelKey: e.supplyChannel.key,
    }));
  const refetch = async () => {
    await first.refetch();
    if (total > 500) await second.refetch();
  };
  return {
    entries,
    loading: first.loading || second.loading,
    error: first.error ?? second.error,
    refetch,
  };
};
