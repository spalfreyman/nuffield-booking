// "Pre-fill forms" demo switch. The choice lives in localStorage so it carries from the front page to every form.
export const PREFILL_KEY = 'nh_prefill';
export const prefillOn = () => typeof window !== 'undefined' && window.localStorage.getItem(PREFILL_KEY) === '1';
export const setPrefill = (on: boolean) => { if (on) window.localStorage.setItem(PREFILL_KEY, '1'); else window.localStorage.removeItem(PREFILL_KEY); };

/** Fictional sample person (example.com address, Ofcom drama phone range, Stripe-style test card). */
export const SAMPLE = {
  name: 'Alex Taylor', title: 'Mr', first: 'Alex', last: 'Taylor', dob: '14/03/1985', sex: 'Male',
  phone: '07700 900123', email: 'alex.taylor@example.com', postcode: 'EC1A 1BB', address: '1 Sample Street, EC1A 1BB',
  location: 'London',
  insurer: 'Bupa', policy: 'BUP-1234567', authCode: 'AUTH-12345', membership: 'NH-123456', company: 'ACME-LTD',
  card: { name: 'Alex Taylor', number: '4242 4242 4242 4242', expiry: '1230', cvc: '123' },
};
/** Returns `sample` when pre-fill is on, else `empty`. Call only from client state initialisers. */
export const pf = <T,>(sample: T, empty: T): T => (prefillOn() ? sample : empty);
