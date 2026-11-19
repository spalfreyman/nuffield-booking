# Merchant Center app: Bookings & availability

Custom application in `merchant-center/` (entry point `nuffield-booking`, built from the official `starter-typescript` template, `@commercetools-frontend/*` 27.17.1). Needs **Node 22.23+/24.22+** (use `nvm use 24`).

## Views (main menu: *Bookings & availability*)
| Route | What it shows | Data |
|---|---|---|
| `/locations` | All points of service, filter by type, services offered per location. Row click opens its calendar | CT GraphQL: `channels`, `inventoryEntries` |
| `/calendar` | Week grid for a location + service. Cell = free/total, green→red utilisation. Click a slot: held, booked via storefront, booked in calendar system, links to the CT order | Calendar API `/api/admin/calendar`, `/api/admin/bookings` |
| `/heatmap` | Locations × next 14 days utilisation for a service. Click opens that location's day | Calendar API `/api/admin/heatmap` |
| `/matrix` | Service × location matrix. With *manage* permission, click a cell to create/delete the inventory entry (confirmed first) | CT GraphQL mutations `createInventoryEntry`, `deleteInventoryEntry` |

Permissions: `view_products` (view), `manage_products` (manage). The matrix is read-only for view-only users.

## Calendar service
The app calls the storefront's mock calendar (`../storefront`, `/api/admin/*`, no patient data returned). Base URL = `CALENDAR_API_URL` (default `http://localhost:3100`). The storefront allows CORS from `ADMIN_ALLOWED_ORIGINS` (default `http://localhost:3001`, the MC dev server). Replace the mock with the real calendar service by keeping the same four endpoints.

**CSP:** Merchant Center serves custom apps with a strict `connect-src` Content-Security-Policy, so the calendar origin must be listed in `headers.csp['connect-src']` in `custom-application-config.mjs` (it uses `CALENDAR_API_URL`). Without it the browser blocks every call with "Cannot reach the calendar service". Restart `npm start` after changing the config. Note `mc-scripts start` serves the app at http://localhost:3001 (origin localhost, so CORS from `localhost:3001` applies, not the mc.* origin).

## Run locally
```bash
nvm use 24
# terminal 1: calendar + storefront
cd storefront && npm run dev            # http://localhost:3100
# terminal 2: MC app
cd merchant-center
npx mc-scripts login                    # one-time, opens browser, pick project nuffield_presales_demo
npm start                               # http://localhost:3001
```

## Deploy (via Connect)
1. In Merchant Center: Organization settings → Custom applications → register with entry point `nuffield-booking`, a placeholder URL, scopes view/manage products → note the **application ID**.
2. Push the repo, tag a release, then `commercetools connect connectorstaged create` → `publish` → `deployment create` supplying `CUSTOM_APPLICATION_ID`, `CALENDAR_API_URL` (public URL of the calendar service), region.
3. Put the deployed URL into the Merchant Center registration.
4. Set `ADMIN_ALLOWED_ORIGINS` on the calendar service to the deployed app origin.
