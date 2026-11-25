// Creates a commercetools cart (customer group + slot on the line item) and turns it into an order.
// Disabled with NH_CT_ORDERS=false. Failure never loses the booking: the caller records the error.
import { ct, ctConfigured } from './ct';
import type { Audience } from './types';
import type { Booking } from './calendar';
import { relevantFunding } from './funding';
import { appointmentLabel } from './appt';
import { getLocation, getProduct } from './catalogue';

const GROUP: Record<Audience, string | null> = { public: null, insurance: 'cg-insurance', gym: 'cg-gym-member', business: 'cg-business' };
const nonEmpty = (o: Record<string, string | undefined>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v));

export const ordersEnabled = () => ctConfigured() && process.env.NH_CT_ORDERS !== 'false';

export interface CartBits { startsAt: string; endsAt: string; locationKey: string; sku: string; format: 'in-person' | 'remote' }

/** Order-level fields that make the appointment readable in Merchant Center. */
export function appointmentFields(c: CartBits) {
  const loc = getLocation(c.locationKey), prod = getProduct(c.sku, 'public');
  return nonEmpty({
    appointmentTime: appointmentLabel(c.startsAt, c.endsAt),
    appointmentStartsAt: c.startsAt, appointmentEndsAt: c.endsAt,
    appointmentLocation: loc?.name, appointmentService: prod?.name,
  });
}

/** A cart created from a Merchant Center "booking link": the selection, no customer details yet. */
export async function createShareCart(input: { locationKey: string; sku: string; startsAt: string; endsAt: string; audience: Audience; format: 'in-person' | 'remote' }) {
  const cart = await ct('POST', '/carts', {
    currency: 'GBP', country: 'GB', taxMode: 'Disabled',
    ...(GROUP[input.audience] ? { customerGroup: { typeId: 'customer-group', key: GROUP[input.audience] } } : {}),
    custom: {
      type: { typeId: 'type', key: 'nh-booking-cart' },
      fields: { audience: input.audience, bookingStatus: 'awaiting-customer', source: 'merchant-center-link', ...appointmentFields(input) },
    },
    lineItems: [{
      sku: input.sku, quantity: 1,
      distributionChannel: { typeId: 'channel', key: input.locationKey },
      custom: { type: { typeId: 'type', key: 'nh-booking-line' }, fields: { startsAt: input.startsAt, endsAt: input.endsAt, format: input.format, appointmentTime: appointmentLabel(input.startsAt, input.endsAt) } },
    }],
  });
  return cart as { id: string; version: number };
}

export async function createOrder(b: Booking, endsAt: string, format: 'in-person' | 'remote', cartId?: string) {
  const p = b.patient;
  // Only details that apply to the customer type are stored (a self-pay order must not carry policy or company data).
  const fu = relevantFunding(b.audience, b.funding);
  const address = {
    country: 'GB', title: p.title, firstName: p.first, lastName: p.last, email: p.email, phone: p.phone,
    postalCode: p.postcode, streetName: p.address,
  };
  const customFields = nonEmpty({
    audience: b.audience, insurer: fu.insurer, policyNumber: fu.policy, authCode: fu.authCode,
    membershipNumber: fu.membership, companyCode: fu.company, bookingStatus: 'confirmed', calendarBookingId: b.reference,
    paymentToken: b.paymentToken ?? undefined,
    ...appointmentFields({ startsAt: b.startsAt, endsAt, locationKey: b.locationKey, sku: b.sku, format }),
  });
  const patientJson = JSON.stringify({ title: p.title, dob: p.dob, sexAtBirth: p.sex });

  // Reuse the cart from a booking link when it still holds the same selection; otherwise build a fresh one.
  if (cartId) {
    const existing = await ct('GET', `/carts/${cartId}`).catch(() => null);
    const li = existing?.lineItems?.[0];
    if (existing && existing.cartState === 'Active' && li?.variant?.sku === b.sku && li.custom?.fields?.startsAt === b.startsAt) {
      const actions: any[] = [
        { action: 'setCustomerEmail', email: p.email },
        { action: 'setBillingAddress', address }, { action: 'setShippingAddress', address },
        ...(GROUP[b.audience] ? [{ action: 'setCustomerGroup', customerGroup: { typeId: 'customer-group', key: GROUP[b.audience] } }] : []),
        ...Object.entries(customFields).map(([name, value]) => ({ action: 'setCustomField', name, value })),
        { action: 'setLineItemCustomField', lineItemId: li.id, name: 'slotId', value: b.slotId },
        { action: 'setLineItemCustomField', lineItemId: li.id, name: 'clinicianId', value: b.slotId.split('|')[3] },
        { action: 'setLineItemCustomField', lineItemId: li.id, name: 'endsAt', value: endsAt },
        { action: 'setLineItemCustomField', lineItemId: li.id, name: 'patient', value: patientJson },
      ];
      const updated = await ct('POST', `/carts/${cartId}`, { version: existing.version, actions });
      const order = await ct('POST', '/orders', { id: updated.id, version: updated.version, orderNumber: b.reference });
      return { orderId: order.id as string, orderNumber: order.orderNumber as string, total: order.totalPrice.centAmount as number };
    }
  }

  const cart = await ct('POST', '/carts', {
    currency: 'GBP', country: 'GB', taxMode: 'Disabled', customerEmail: p.email,
    ...(GROUP[b.audience] ? { customerGroup: { typeId: 'customer-group', key: GROUP[b.audience] } } : {}),
    billingAddress: address, shippingAddress: address,
    custom: { type: { typeId: 'type', key: 'nh-booking-cart' }, fields: customFields },
    lineItems: [{
      sku: b.sku, quantity: 1,
      distributionChannel: { typeId: 'channel', key: b.locationKey },
      custom: {
        type: { typeId: 'type', key: 'nh-booking-line' },
        fields: nonEmpty({
          slotId: b.slotId, startsAt: b.startsAt, endsAt, clinicianId: b.slotId.split('|')[3], format,
          appointmentTime: appointmentLabel(b.startsAt, endsAt), patient: patientJson,
        }),
      },
    }],
  });
  const order = await ct('POST', '/orders', { id: cart.id, version: cart.version, orderNumber: b.reference });
  return { orderId: order.id as string, orderNumber: order.orderNumber as string, total: order.totalPrice.centAmount as number };
}
