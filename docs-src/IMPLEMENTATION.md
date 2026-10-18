# Implementation and reference notes

## Inputs inspected

- `C:\Users\MR. Beast\Downloads\FireCam Backend.zip`
- `C:\Users\MR. Beast\Downloads\Frontend.mov` (2 minutes 38 seconds; a contact sheet sampled at 15-second intervals was reviewed).
- Awwwards design listings and mobile performance material (links in ASSETS.md and the site's proposal page).

The video shows registration/login, a red sidebar, overview statistics, camera location tabs/search, a floor-plan canvas with floor creation and image import, alert history, profile settings, and emergency contacts. Those workflows shaped the information architecture. The new site replaces the visual treatment with warm neutral surfaces, charcoal/green structural colours, and an orange action colour.

## Original backend findings

The supplied application is Express/TypeScript with Passport sessions, OpenAI image analysis, WebSockets, and schema definitions for users, cameras, sensors, zones, alerts, contacts, and settings. Its runtime storage implementation uses JavaScript maps seeded with demonstration records. That data disappears on restart. Several device routes are not protected by account authentication and records are globally shared. AI errors can be translated to non-detection results. These behaviours were not carried into the new local app.

The new `server.mjs` is a focused, dependency-free local implementation derived from the original resource model, not a claim that every original endpoint or AI integration has been completed. It stores records per user in SQLite, requires sessions for workspace routes, and uses server-sent events for workspace updates. Original code remains available separately for future integration.

## API surface

| Route | Behaviour |
| --- | --- |
| `GET /api/health` | Service identity and connected capability status |
| `POST /api/register`, `/api/login`, `/api/logout` | Account/session lifecycle |
| `GET/PATCH /api/user` | Current user's profile |
| `GET /api/bootstrap` | Current user's complete workspace |
| `GET /api/events` | Session-authenticated server-sent update stream |
| `GET/POST /api/{cameras,sensors,zones,alerts,contacts,floors}` | List/create records for current user |
| `GET/PATCH/DELETE /api/{resource}/:id` | Current user's individual record |
| `GET/POST /api/settings` | Current user's workspace preferences |
| `POST /api/analyze-image`, `/api/verify-smoke`, `/api/notify-contacts` | Explicit service-unavailable response until connected |

Manual alerts remain `simulated: true` and `aiVerified: false`. Creating a physical camera record does not mark it online. The app never retrieves remote camera URLs on the server; an explicitly opened browser preview loads them directly.

## Deployment split

The hosted Worker uses platform-verified identity headers and D1. `/api/register` creates a FireCam profile only after ChatGPT sign-in. Every workspace API checks both identity and registration, with ownership in each record query. API responses use `Cache-Control: no-store`. The platform owns `/signin-with-chatgpt` and `/signout-with-chatgpt`; the app does not issue hosted sessions. Schema migrations are in `drizzle/`.

The Node server serves `public/` and `/api/` locally, with password-based accounts and SQLite sessions. `npm run build` embeds public assets in the hosted Worker under `dist/server/index.js`. Hosted session validity is checked on route entry, focus, and every 30 seconds. Failed verification closes the dashboard. Service worker caches exclude API and identity routes. Browser-storage demo flags are discarded.

## Acceptance boundary

Automated checks verify application logic and HTTP behaviour. No camera was accessed, no outbound contact message was sent, no emergency number was called, and no production credential from the supplied archive was used. Full browser/device visual QA is pending because the environment denied browser observation of the local preview. Live telemetry, detection, notification delivery, and background operation are outside this release and listed in the in-site proposal.
