<p align="center"><img src="showcase/assets/firecam-logo.png" alt="FireCam" width="120"></p>

# FireCam

**A clearer view of a home incident, from the first alert to human review.**

FireCam is an interactive fire-safety product showcase: a public product website, account access, a demo monitoring workspace, replayable incident scenarios and an experimental image review lab.

[Open the live app](https://firecam-showcase.netlify.app/) · [Presentation walkthrough](docs-src/PRESENTATION.md) · [Architecture](docs-src/ARCHITECTURE.md) · [Deployment](docs-src/DEPLOYMENT.md)

![FireCam checks](https://github.com/swera-asif/FireCam/actions/workflows/ci.yml/badge.svg)

![FireCam concept residence — generated artwork, not a connected property](showcase/assets/hero.webp)

## Explore the project

Open the live site and select **Register**. Confirm your email, then sign in. Registration is the public entry point; there is no request-demo form. For a local presentation of the sample workspace, follow the setup below.

| Area | What you can demonstrate |
| --- | --- |
| Product website | Product concept, proposed workflow and delivery scope |
| Dashboard and scenarios | Suspected fire, likely false alarm and missing-evidence scenarios; step through or replay incident handling |
| Cameras and floor plan | Search illustrative camera views and change sample device placement |
| Alerts and contacts | Review sample incidents, export CSV and edit fictional contacts |
| Voice workspace | Record, play and download local microphone audio; try local push-to-talk capture |
| Detection lab | Inspect an image or camera frame with colour/motion rules; optionally request AI review |
| Preferences | Change sample home details, theme and reset browser-local demo data |

## The everyday app

After sign-in, FireCam opens as a four-tab app (Home, Alerts, Rooms, Family) with a three-step setup: choose where to listen, name the room, add one phone number.

- **Smoke-alarm sound detection.** With "Use this phone", the phone's microphone listens for the standard smoke-alarm beep pattern (ISO 8201 Temporal-Three) and the carbon-monoxide pattern (Temporal-Four). Analysis runs in an AudioWorklet on the device; no audio is recorded or uploaded. See [`showcase/src/alarm.js`](showcase/src/alarm.js).
- **Alerts.** A detected pattern opens a full-screen alert with a siren, vibration, a spoken message and a notification, and three large buttons: *It's a false alarm*, *Call fire service* and *Call my family*. Calls and texts use the phone's own dialer and SMS app (`tel:` and `sms:` links), so there is no messaging bill. If nobody responds within 30 seconds the alert moves to the family stage, then to the fire-service prompt.
- **Fire-service number per country.** Defaults to Rescue 1122 (with 16 as the alternative) for Pakistan; other countries and a custom number are in Settings, along with the home address shown on every alert.
- **Test my alerts.** Rings this phone with the full alert flow and records the last test date. Settings → Advanced can also play an 8-second smoke-alarm sound to check detection on a second phone.
- **English and Urdu, large-text mode,** 48px buttons and 16px body text. The older simulator, detection lab, voice tools and floor plan live under Settings → Advanced & practice.

- **Guest mode.** *Try without an account* opens the app with everything saved on the phone.
- **Accounts, sync and family push (free).** With a Supabase free-tier project connected, email accounts keep rooms, family and alerts in sync across devices; family members join a home with a 6-letter invite code; and every joined phone gets a free Web Push alarm notification even when FireCam is closed, sent by a Netlify function with VAPID keys. Setup steps: [docs-src/SUPABASE-SETUP.md](docs-src/SUPABASE-SETUP.md). Until the keys are added the site runs in local mode.

- **Android app.** The same app wrapped with Capacitor, plus a foreground service that keeps listening with the screen off, a full-screen alarm notification that rings at alarm volume, and Firebase push for family alerts when the app is closed. Build steps, signing and the free Firebase setup: [docs-src/ANDROID.md](docs-src/ANDROID.md).

Everything above runs at zero hosting cost.

**Project status:** a functional development showcase, not a production monitoring or certified fire-alarm system. Home sensors, remote cameras, incident assessments, notifications and monitoring-centre handoffs are simulated. No emergency calls or messages are sent. Local camera/microphone capture and explicitly requested provider reviews are real.

## Run locally

Requires **Node.js 24+** and npm. From a fresh clone:

```sh
git clone https://github.com/swera-asif/FireCam.git
cd FireCam
npm --prefix showcase ci
npm start
```

Open **http://127.0.0.1:4180/#/dashboard**. On Windows, `Start-FireCam.cmd` installs dependencies, builds and starts the same showcase.

The local server allows the sample workspace without managed login when Netlify Identity is unavailable. Identity and the AI function require a Netlify deployment; `npm start` does not emulate them.

## Verify and build

```sh
npm run check                    # active showcase syntax checks
npm test                         # behaviour and API tests with mocked providers
npm run test:pages               # GitHub Pages redirect checks
npm run build                    # clean dependency install and production build
```

Output: `showcase/dist/`. GitHub Actions runs syntax, tests, build and redirect checks on pushes to `main` and pull requests. Camera permissions, email delivery and real provider access also need browser/account acceptance checks; automated tests do not prove these integrations work end to end.

## Hosting and data

- **Live app:** Netlify builds `showcase/` using [`netlify.toml`](netlify.toml). Production branch: `main`.
- **Accounts:** Netlify Identity manages registration, confirmation, login and recovery.
- **Demo records:** localStorage in the current browser, shared by accounts using that browser profile. These are not private cloud records.
- **Media:** microphone recordings stay in memory until downloaded, refreshed or the tab closes. Camera images stay local unless sent for review.
- **Optional AI:** a signed-in visitor supplies their own OpenRouter, Gemini, Anthropic, OpenAI, xAI, Groq or Mistral key, or a public HTTPS OmniRoute gateway URL and key. The key and selected image pass through the Netlify function to that provider. Keys stay in page memory and clear on leaving the lab. No project-owned API key is required.
- **GitHub Pages:** only redirects to Netlify; it is not a second app or authentication service.

## Repository map

| Path | Purpose |
| --- | --- |
| [`showcase/src/`](showcase/src/) | Active UI, state model, image rules and media capture |
| [`showcase/assets/`](showcase/assets/) | Logo, artwork, sample interiors and fonts |
| [`showcase/netlify/`](showcase/netlify/) | Authenticated AI function and provider adapters |
| [`showcase/tests/`](showcase/tests/) | Current application tests |
| [`showcase/android/`](showcase/android/) | Capacitor Android project: listening service, alarm channel, plugin bridge |
| [`supabase/`](supabase/) | Database schema and row-level security for accounts, sync and sharing |
| [`docs-src/`](docs-src/) | Architecture, presentation, deployment and asset notes |
| [`docs/`](docs/) and [`github/`](github/) | Pages redirect output and URL configuration |
| [`scripts/`](scripts/) | Verification and redirect tooling; historical Worker builder |
| `server.mjs`, `worker/`, `lib/`, `drizzle/`, `migrations/`, older `tests/` | Earlier backends and tests; excluded from the live build |

Start application work in **`showcase/`**. [Historical implementation notes](docs-src/IMPLEMENTATION.md) describe prior prototypes; their setup and storage models do not describe the live site.

## Scope and next steps

Next stages are physical device integration, validated detection, account-isolated cloud history, notification delivery, monitoring-centre integration and device/browser acceptance testing. A successful demo scenario does not imply these integrations exist.

See [asset credits](docs-src/ASSETS.md) for artwork and font/photo attribution. No general source-code licence is declared; the font licence applies to its font files.
