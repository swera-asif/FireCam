# FireCam

A development showcase for a home fire-safety camera concept: product site, registration, a demo workspace with replayable incident scenarios, and a detection lab.

**Site: https://firecam-showcase.netlify.app**

## How it works

- **Hosting:** Netlify (`netlify.toml`, site `firecam-showcase`). The static app is built from [`showcase/`](showcase/); one Netlify Function handles optional AI image review.
- **Accounts:** Netlify Identity (email and password, email confirmation required). Visitors register first, then sign in to open the demo dashboard. No separate database is needed.
- **Demo data:** sample incidents, contacts and preferences are stored only in the visitor's own browser (localStorage).
- **GitHub:** this repository. `swera-asif.github.io/FireCam` only forwards to the Netlify site; `npm run build:github` regenerates that redirect in `docs/` from the URL in `github/portal-config.js`.

## Detection lab

1. **Local image rules** (default): colour-and-motion checks on a camera frame or an uploaded image. No AI and no API key.
2. **Optional AI review:** one image per request to OpenRouter (free `:free` vision models by default) or Google Gemini, using the visitor's own API key. Keys are kept in page memory only and are never stored or committed. A chat subscription (ChatGPT, Claude, Gemini) does not provide API access.

Neither is a validated fire detector. No detected cue means safety is unknown. Physical alarms must stay in place.

## Develop

Requires Node.js 24+.

```
npm --prefix showcase install
npm start          # builds, then serves http://127.0.0.1:4180
npm test           # showcase tests
```

On `localhost` the workspace opens without login (Netlify Identity only exists on the deployed site). On the deployed site the dashboard requires registration.

## Deploy

```
npx netlify-cli deploy --prod --site <site-id> --dir showcase/dist --functions showcase/netlify/functions
```

Netlify builds `showcase/` using `netlify.toml`. Never commit API keys, `.env` files or tokens.

## Scope

Automated fire detection, physical sensor telemetry, emergency dispatch and outbound notifications are **not** connected. All sensors, cameras, alerts and handoffs in the demo are simulated.
