# FireCam

Responsive product website and account-protected monitoring workspace.

Website: https://swera-asif.github.io/FireCam/

## GitHub Pages

Publish the `main` branch's `/docs` folder in Settings → Pages. The prepared site supports Google and email/password authentication through Firebase. **Authentication is not active until a Firebase project is configured.** Until then, login is disabled and the dashboard remains inaccessible.

Follow [Firebase setup](docs/FIREBASE-SETUP.md). After changing the source or Firebase configuration, run:

```
node scripts/build-github.mjs
```

Firebase configuration belongs in `github/firebase-config.js`. Publish `firestore.rules` to enforce account isolation. Never commit private keys, service-account JSON, `.env`, or databases.

## Local application

Requires Node.js 24+. Run `npm start`, then open http://localhost:4173. The local Node/SQLite application uses username/password accounts and serves `public/`.

```
npm run check
npm test
```

The `worker/` and `drizzle/` sources retain the separate Sites deployment implementation. GitHub Pages uses the Firebase adapter in `github/`; it does not run a Node or Worker server.

## Included

Responsive product/proposal pages, cameras, floor plans, contacts, simulated alerts, export, settings and provided FireCam logo. Automated fire detection, physical sensor telemetry, emergency dispatch, and outbound notifications are not connected. Manual alerts are explicitly simulated.

## Validation

Local API and hosted Worker authentication tests pass. GitHub Pages path checks and the disabled-auth state are checked locally. Live Google/email registration and Firestore rule enforcement must be verified after Firebase setup.
