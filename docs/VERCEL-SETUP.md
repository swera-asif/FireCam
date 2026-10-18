# Vercel portal setup for FireCam

GitHub Pages (`swera-asif.github.io/FireCam`) serves the public product website. Sign-in, registration and the private dashboard run on Vercel, which serves `public/` together with the account API in `api/index.js` and stores records in PostgreSQL. Until the portal URL is configured, the Pages site shows "The account portal is not available yet" instead of a form.

## 1. Deploy the portal

1. Open https://vercel.com/new, sign in with the GitHub account that owns `swera-asif/FireCam`, and import the repository. Keep **Framework Preset: Other**. `vercel.json` already sets the build command (`npm run build:vercel`) and output directory (`public`).
2. In the project's **Storage** tab add a Postgres database (Neon or Vercel Postgres, free tier is enough) and connect it to the project. This creates the `DATABASE_URL` environment variable. If you use another provider, add `DATABASE_URL` yourself under **Settings → Environment Variables** for Production and Preview.
3. Redeploy. The build runs `scripts/migrate.mjs`, which creates the `firecam_*` tables. Without `DATABASE_URL` the site still deploys, but `/api/health` reports `ready: false` and the sign-in page stays disabled.
4. Open `https://<your-project>.vercel.app/api/health`. It must return `"ready": true`. Then open `https://<your-project>.vercel.app/#/register` and create a test account.

## 2. Point the GitHub Pages site at the portal

1. Edit `github/portal-config.js` and replace `null` with the portal origin, without a trailing slash:

   ```js
   export const portalUrl = 'https://<your-project>.vercel.app';
   ```

2. Run `npm run build:github`, commit the changed files (including `docs/`), and push `main`. GitHub Pages publishes `main → /docs`.
3. On the Pages site every "Explore the platform", "Sign in", "#/login", "#/register" and dashboard link now opens the Vercel portal. Returning visitors pick up the new configuration on their next load because the service worker no longer caches scripts.

## 3. Verify

- Register, sign out, and open `#/alerts` while signed out (it must redirect to sign-in).
- Register a second account and confirm neither account sees the other's cameras, floors or contacts.
- Password rules: at least 10 characters. Sign-in attempts are rate-limited per IP and per email (10-minute window).

## Notes

- `DATABASE_URL` is the only secret. Never commit it. Session cookies are `__Host-` prefixed, HttpOnly and Secure, so the portal only works over HTTPS (Vercel provides this).
- Phone/SMS sign-in and Google sign-in are not part of this release.
- The local `npm start` app (Node.js + SQLite) is unchanged and independent of the portal.
