import React, { useState } from 'react';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import SelectInput from '@commercetools-uikit/select-input';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextInput from '@commercetools-uikit/text-input';
import { useCalendarBaseUrl } from '../../hooks/use-calendar-api';

const AUDIENCES = [
  { value: 'public', label: 'Self-pay' },
  { value: 'insurance', label: 'Medical insurance' },
  { value: 'gym', label: 'Gym member' },
  { value: 'business', label: 'Business / corporate' },
];

type Link = {
  cartId: string;
  url: string;
  service: string;
  location: string;
  when: string;
  audience: string;
};

/** Creates a commercetools cart for the selected slot and shows a link the customer can open to finish the booking. */
const BookingLink = ({
  locationKey,
  sku,
  startsAt,
  projectKey,
}: {
  locationKey: string;
  sku: string;
  startsAt: string;
  projectKey?: string;
}) => {
  const base = useCalendarBaseUrl();
  const [audience, setAudience] = useState('public');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<Link | null>(null);
  const [copied, setCopied] = useState(false);

  // a different slot or service invalidates the link that was shown
  const key = `${locationKey}|${sku}|${startsAt}`;
  const [forKey, setForKey] = useState(key);
  if (forKey !== key) {
    setForKey(key);
    setLink(null);
    setError(null);
    setCopied(false);
  }

  const create = async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const r = await fetch(`${base}/api/admin/share`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ loc: locationKey, sku, startsAt, audience }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Calendar service returned ${r.status}`);
      }
      setLink((await r.json()) as Link);
    } catch (e) {
      setError(
        (e as Error).message === 'Failed to fetch'
          ? `Cannot reach the calendar service at ${base}`
          : (e as Error).message
      );
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
      <Spacings.Stack scale="s">
        <Text.Subheadline as="h4">Book this session</Text.Subheadline>
        <Spacings.Inline scale="m" alignItems="flex-end">
          <div style={{ width: 240 }}>
            <Text.Detail>Customer type</Text.Detail>
            <SelectInput
              name="audience"
              value={audience}
              options={AUDIENCES}
              onChange={(e) => {
                setAudience(e.target.value as string);
                setLink(null);
              }}
            />
          </div>
          <SecondaryButton
            label={busy ? 'Creating…' : 'Create booking link'}
            isDisabled={busy}
            onClick={create}
          />
        </Spacings.Inline>
        {error && <Text.Body tone="negative">{error}</Text.Body>}
        {link && (
          <Spacings.Stack scale="xs">
            <Text.Body>
              {link.service} · {link.location} · {link.when}
            </Text.Body>
            <Spacings.Inline scale="s" alignItems="center">
              <div style={{ flex: 1, minWidth: 320 }}>
                <TextInput
                  name="booking-link"
                  value={link.url}
                  isReadOnly
                  onChange={() => undefined}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <SecondaryButton
                label={copied ? 'Copied ✓' : 'Copy link'}
                onClick={copy}
              />
              <a href={link.url} target="_blank" rel="noreferrer">
                Open
              </a>
            </Spacings.Inline>
            <Text.Detail>
              A cart holding this selection has been created in commercetools
              {projectKey ? (
                <>
                  {' '}
                  (<a href={`/${projectKey}/carts/${link.cartId}`}>view cart</a>
                  )
                </>
              ) : null}
              . The customer opens the link, enters their details and pays; that
              turns the cart into an order. The time is held for 10 minutes once
              they open it.
            </Text.Detail>
          </Spacings.Stack>
        )}
      </Spacings.Stack>
    </div>
  );
};
export default BookingLink;
