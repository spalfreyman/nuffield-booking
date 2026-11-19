// Creates a commercetools cart (customer group + slot on the line item) and turns it into an order.
// Disabled with NH_CT_ORDERS=false. Failure never loses the booking: the caller records the error.
import { ct, ctConfigured } from './ct';
import type { Audience } from './types';
import type { Booking } from './calendar';

const GROUP: Record<Audience, string | null> = { public: null, insurance: 'cg-insurance', gym: 'cg-gym-member', business: 'cg-business' };
const nonEmpty = (o: Record<string, string | undefined>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v));

export const ordersEnabled = () => ctConfigured() && process.env.NH_CT_ORDERS !== 'false';

export async function createOrder(b: Booking, endsAt: string, format: 'in-person' | 'remote') {
  const p = b.patient, fu = b.funding;
  const address = {
    country: 'GB', title: p.title, firstName: p.first, lastName: p.last, email: p.email, phone: p.phone,
    postalCode: p.postcode, streetName: p.address,
  };
  const cart = await ct('POST', '/carts', {
    currency: 'GBP', country: 'GB', taxMode: 'Disabled', customerEmail: p.email,
    ...(GROUP[b.audience] ? { customerGroup: { typeId: 'customer-group', key: GROUP[b.audience] } } : {}),
    billingAddress: address, shippingAddress: address,
    custom: {
      type: { typeId: 'type', key: 'nh-booking-cart' },
      fields: nonEmpty({
        audience: b.audience, insurer: fu.insurer, policyNumber: fu.policy, authCode: fu.authCode,
        membershipNumber: fu.membership, companyCode: fu.company, bookingStatus: 'confirmed', calendarBookingId: b.reference,
        paymentToken: b.paymentToken ?? undefined,
      }),
    },
    lineItems: [{
      sku: b.sku, quantity: 1,
      distributionChannel: { typeId: 'channel', key: b.locationKey },
      custom: {
        type: { typeId: 'type', key: 'nh-booking-line' },
        fields: nonEmpty({
          slotId: b.slotId, startsAt: b.startsAt, endsAt, clinicianId: b.slotId.split('|')[3], format,
          patient: JSON.stringify({ title: p.title, dob: p.dob, sexAtBirth: p.sex }),
        }),
      },
    }],
  });
  const order = await ct('POST', '/orders', { id: cart.id, version: cart.version, orderNumber: b.reference });
  return { orderId: order.id as string, orderNumber: order.orderNumber as string, total: order.totalPrice.centAmount as number };
}
