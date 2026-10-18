# FireCam

Responsive product website and account-protected monitoring workspace.

**Site: https://firecam-portal.vercel.app**

## Hosting

The whole site (landing page, proposal, registration, sign-in, dashboard and the account API) runs on Vercel, project `firecam-portal` in team `sw-era`, deployed from `main`. Vercel serves `public/` together with `api/index.js`; workspace records live in a Neon PostgreSQL database (`DATABASE_URL`). See [Vercel setup](docs-src/VERCEL-SETUP.md).

`swera-asif.github.io/FireCam` only forwards to the site. `npm run build:github` regenerates that redirect in `docs/` from the URL in `github/portal-config.js`; commit `docs/` after running it.

Never commit `DATABASE_URL`, `.env`, or databases.

## Local application

Requires Node.js 24+. Run `npm start`, then open http://localhost:4173. The local Node/SQLite application uses username/password accounts and serves `public/`.

```
npm run check
npm test
```

The `worker/` and `drizzle/` sources retain the earlier Sites deployment implementation and are not used.

## Included

Responsive product/proposal pages, cameras, floor plans, contacts, simulated alerts, export, settings and the provided FireCam logo. Automated fire detection, physical sensor telemetry, emergency dispatch, and outbound notifications are not connected. Manual alerts are explicitly simulated.

## Validation

Local API tests pass (`npm test`). `node tests/github-smoke.mjs` checks the Pages redirect. Live registration, sign-in, the auth guard and the dashboard were verified on the deployed site.
