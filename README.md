# FireCam

Responsive product website and account-protected monitoring workspace.

Website: https://swera-asif.github.io/FireCam/

## Hosting layout

| Part | Where | What it does |
| --- | --- | --- |
| Public product site | GitHub Pages (`main` → `/docs`) | Landing page, proposal, FAQs. Static only. |
| Account portal | Vercel (`public/` + `api/index.js`) | Email/password registration, sign-in, private dashboard, PostgreSQL records. |
| Local app | `npm start` | Same interface with a Node.js/SQLite server on `http://localhost:4173`. |

Sign-in on the Pages site is disabled until the Vercel portal is deployed and its URL is set in `github/portal-config.js`. Follow [Vercel setup](docs/VERCEL-SETUP.md).

After changing the source or the portal URL, run:

```
npm run build:github
```

and commit `docs/`. Never commit `DATABASE_URL`, `.env`, or databases.

## Local application

Requires Node.js 24+. Run `npm start`, then open http://localhost:4173. The local Node/SQLite application uses username/password accounts and serves `public/`.

```
npm run check
npm test
```

The `worker/` and `drizzle/` sources retain the earlier Sites deployment implementation and are not used by Pages or Vercel.

## Included

Responsive product/proposal pages, cameras, floor plans, contacts, simulated alerts, export, settings and the provided FireCam logo. Automated fire detection, physical sensor telemetry, emergency dispatch, and outbound notifications are not connected. Manual alerts are explicitly simulated.

## Validation

Local API tests pass (`npm test`). The GitHub Pages build is checked by `tests/github-smoke.mjs` (needs `FIRECAM_DOM_MODULE` pointing at linkedom). Live registration, sign-out, auth-guard redirects and account isolation must be verified on the deployed Vercel portal after setup.
