# GitHub Pages redirect

The application runs at [firecam-showcase.netlify.app](https://firecam-showcase.netlify.app/). GitHub Pages only forwards visitors there, including hash routes.

`portal-config.js` supplies the destination. From the repository root:

```sh
npm run build:github
npm run test:pages
```

If Pages is enabled, publish `main` → `/docs`. That directory contains the redirect pages and a retiring service worker for old installations.

`data.js` is a historical adapter, not bundled or deployed. Firebase, Firestore and earlier Sites/Node backends are not used by the Netlify showcase. Follow the [current deployment guide](../docs-src/DEPLOYMENT.md).
