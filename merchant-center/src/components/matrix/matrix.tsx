import React, { useState } from 'react';
import { useIsAuthorized } from '@commercetools-frontend/permissions';
import { useMcMutation } from '@commercetools-frontend/application-shell';
import { GRAPHQL_TARGETS } from '@commercetools-frontend/constants';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import { ContentNotification } from '@commercetools-uikit/notifications';
import CreateInventory from '../../graphql/create-inventory.ctp.graphql';
import DeleteInventory from '../../graphql/delete-inventory.ctp.graphql';
import { PERMISSIONS } from '../../constants';
import { useCalendarApi } from '../../hooks/use-calendar-api';
import { useInventory, useLocations } from '../../hooks/use-locations';
import type { Service } from '../../types';
import { Async } from '../common';

const target = { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM };

const Matrix = () => {
  const { locations, loading, error } = useLocations();
  const inv = useInventory();
  const services = useCalendarApi<{ services: Service[] }>(
    '/api/admin/services'
  );
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.Manage],
  });
  const [create] = useMcMutation<
    { createInventoryEntry: { id: string } },
    { draft: unknown }
  >(CreateInventory);
  const [remove] = useMcMutation<
    { deleteInventoryEntry: { id: string } },
    { id: string; version: number }
  >(DeleteInventory);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  const svc = services.data?.services ?? [];
  const find = (sku: string, key: string) =>
    inv.entries.find((e) => e.sku === sku && e.channelKey === key);

  const toggle = async (
    sku: string,
    locKey: string,
    locName: string,
    svcName: string
  ) => {
    const existing = find(sku, locKey);
    const verb = existing ? 'Stop offering' : 'Start offering';
    if (
      !window.confirm(
        `${verb} "${svcName}" at ${locName}?\n\nThis ${
          existing ? 'removes' : 'creates'
        } the inventory entry in commercetools and ${
          existing ? 'hides' : 'shows'
        } the service at this location in the booking journey.`
      )
    )
      return;
    setBusy(`${sku}|${locKey}`);
    setMsg(null);
    try {
      if (existing)
        await remove({
          context: target,
          variables: { id: existing.id, version: existing.version },
        });
      else
        await create({
          context: target,
          variables: {
            draft: {
              key: `inv-${sku}-${locKey}`.slice(0, 256),
              sku,
              supplyChannel: { typeId: 'channel', key: locKey },
              quantityOnStock: 60,
            },
          },
        });
      await inv.refetch();
      setMsg({
        type: 'success',
        text: `${existing ? 'Removed' : 'Added'} ${svcName} at ${locName}.`,
      });
    } catch (e) {
      setMsg({ type: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Spacings.Stack scale="l">
      <Text.Headline as="h2">Services by location</Text.Headline>
      <Text.Body>
        Which services each location offers (commercetools inventory entries per
        channel).{' '}
        {canManage
          ? 'Click a cell to switch a service on or off.'
          : 'You have view-only access.'}
      </Text.Body>
      {msg && (
        <ContentNotification type={msg.type}>
          <Text.Body>{msg.text}</Text.Body>
        </ContentNotification>
      )}
      <Async
        loading={loading || inv.loading || services.loading}
        error={error?.message ?? inv.error?.message ?? services.error}
      >
        <div style={{ overflow: 'auto', maxHeight: '68vh' }}>
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
                    left: 0,
                    background: '#fff',
                    textAlign: 'left',
                    minWidth: 260,
                    zIndex: 2,
                  }}
                >
                  Location
                </th>
                {svc.map((s) => (
                  <th
                    key={s.sku}
                    style={{
                      position: 'sticky',
                      top: 0,
                      background: '#fff',
                      fontWeight: 500,
                      minWidth: 90,
                      verticalAlign: 'bottom',
                    }}
                  >
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locations.map((l) => (
                <tr key={l.key}>
                  <td
                    style={{ position: 'sticky', left: 0, background: '#fff' }}
                  >
                    {l.name.replace('Nuffield Health ', '')}
                  </td>
                  {svc.map((s) => {
                    const on = !!find(s.sku, l.key);
                    const working = busy === `${s.sku}|${l.key}`;
                    return (
                      <td
                        key={s.sku}
                        onClick={() =>
                          canManage &&
                          !busy &&
                          toggle(s.sku, l.key, l.name, s.name)
                        }
                        style={{
                          textAlign: 'center',
                          padding: '5px 2px',
                          borderRadius: 3,
                          background: on ? '#d6efdf' : '#f3f3f3',
                          color: on ? '#14532d' : '#aaa',
                          cursor: canManage ? 'pointer' : 'default',
                          opacity: working ? 0.4 : 1,
                        }}
                      >
                        {on ? '✓' : '–'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Async>
    </Spacings.Stack>
  );
};
Matrix.displayName = 'Matrix';
export default Matrix;
