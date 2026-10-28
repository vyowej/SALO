# SALO Frontend

SALO is a mobile-first Filipino food ordering and reservation experience built with React, Vite, and plain CSS. The current app is a frontend preview: data, accounts, addresses, order progression, and payments are mocked in the browser.

## Run locally

```sh
npm install
npm run dev
```

Open the Vite URL shown in the terminal. Use `npm run build` for a production build and `npm run lint` for ESLint.

## Main routes

| Route | Screen |
| --- | --- |
| `/` | Landing page or customer home |
| `/restaurants` | Searchable and filterable restaurant list |
| `/restaurants/:id` | Restaurant menu, item options, and cart |
| `/cart` | Cart, voucher, and delivery or pick-up |
| `/checkout` | Contact, address, fulfilment, payment, and order review |
| `/orders` | Ongoing and completed order history |
| `/orders/:id` | Order tracking, cancellation, receipt, and review |
| `/register` | Four-step customer registration |
| `/login` | Demo and registered-user login |
| `/forgot-password` | Mock password reset confirmation |
| `/profile` | Account and saved address management |
| `/reservations`, `/reserve` | Reservation browsing and form |
| `/dashboard`, `/rider`, `/admin` | Role-specific demo workspaces |
| `/settings`, `/partner/apply`, `/rider/apply` | Account settings and partner applications |

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Customer | `customer@salo.app` | `customer123` |
| Business owner | `owner@salo.app` | `rider123` |
| Rider | `rider@salo.app` | `rider123` |
| Admin | `admin@salo.app` | `admin123` |

New registrations are saved in local storage and automatically signed in as customers. The mock verification code is `123456`; unverified users can browse but must verify before checkout. Mock authentication and browser storage are not secure and must not be used for production credentials or personal data.

## Location configuration

Copy `.env.example` to `.env.local` if you need to change the preview configuration:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_USE_MOCK` | `true` | Keeps service data in mock mode |
| `VITE_LOCATION_PROVIDER` | `mock` | Selects the location adapter |
| `VITE_MAPS_API_KEY` | empty | Reserved for a future map/geocoding provider |
| `VITE_PSGC_BASE_URL` | empty | Reserved for a future PSGC-compatible endpoint |

Only the mock location provider is implemented. Other provider names fail explicitly rather than silently using mock data. See [docs/LOCATION_API_NOTES.md](./docs/LOCATION_API_NOTES.md) before connecting a real provider; verify endpoint URLs and usage policies first. The map is a local SVG placeholder, browser geolocation is requested only after a user action, and mock coverage, distance, and fees are preview values.

## Mock behavior and assumptions

- All fabricated preview records and demo credentials live under `src/mock`; screens request them through the adapters in `src/services`.
- Forms start without sample personal details or reservation selections. Placeholders describe the expected input.
- Account, address, cart, and order state persist in browser local storage. Clearing site data resets the preview.
- Order statuses advance automatically so the tracking screen can be demonstrated without a backend.
- Checkout supports Cash on Delivery for delivery and Pay at pick-up for pickup; no payment is processed.
- Address fixtures provide representative Philippine regions and cities, not an exhaustive official directory.
- Delivery ranges, fees, voucher codes, ETA values, and reservation behavior are demonstration data, not production promises.
- See [src/mock/README.md](./src/mock/README.md) for a fixture inventory and backend replacement steps.

## Project structure

- `src/components` — reusable UI, location, restaurant, and layout components
- `src/pages` — route-based screens
- `src/services` — service adapters consumed by pages and components
- `src/mock` — demo accounts, fabricated records, and preview configuration
- `src/context` — authentication, cart, and selected-location state
- `src/styles` — shared design tokens and global CSS
- `docs/LOCATION_API_NOTES.md` — future location-provider integration notes
