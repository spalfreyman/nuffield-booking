import { PERMISSIONS, entryPointUriPath } from './src/constants';

/**
 * @type {import('@commercetools-frontend/application-config').ConfigOptionsForCustomApplication}
 */
const config = {
  name: 'Nuffield Booking',
  entryPointUriPath,
  cloudIdentifier: 'gcp-eu',
  env: {
    development: {
      initialProjectKey: 'nuffield_presales_demo',
    },
    production: {
      // Injected by Connect at deploy time (see connect.yaml); placeholders keep local builds working.
      applicationId: process.env.CUSTOM_APPLICATION_ID ?? 'TODO',
      url: process.env.APPLICATION_URL ?? 'https://your_app_hostname.com',
    },
  },
  // Calendar service base URL (the mock calendar API in ../storefront). Set CALENDAR_API_URL at deploy time.
  additionalEnv: { calendarApiUrl: process.env.CALENDAR_API_URL ?? 'http://localhost:3100' },
  // Inventory (service availability per location) lives under the products scopes.
  oAuthScopes: {
    view: ['view_products'],
    manage: ['manage_products'],
  },
  // MC serves a strict Content-Security-Policy (connect-src); the calendar service origin must be listed
  // or the browser blocks every fetch to it.
  headers: {
    csp: {
      'connect-src': [process.env.CALENDAR_API_URL ?? 'http://localhost:3100'],
    },
  },
  icon: '${path:@commercetools-frontend/assets/application-icons/location.svg}',
  mainMenuLink: {
    defaultLabel: 'Bookings & availability',
    labelAllLocales: [],
    permissions: [PERMISSIONS.View],
  },
  submenuLinks: [
    { uriPath: 'locations', defaultLabel: 'Locations', labelAllLocales: [], permissions: [PERMISSIONS.View] },
    { uriPath: 'calendar', defaultLabel: 'Calendar', labelAllLocales: [], permissions: [PERMISSIONS.View] },
    { uriPath: 'heatmap', defaultLabel: 'Availability heatmap', labelAllLocales: [], permissions: [PERMISSIONS.View] },
    { uriPath: 'matrix', defaultLabel: 'Services by location', labelAllLocales: [], permissions: [PERMISSIONS.View] },
  ],
};

export default config;
