# Firebase setup for FireCam

GitHub Pages serves the website. Firebase provides Google/email sign-in and private cloud records. Sign-in remains disabled until configured.

1. Open https://console.firebase.google.com/ with your Google account and create a project named FireCam. You can leave Google Analytics off. Do not enable paid services just for this setup.
2. Register a Web app in Project settings. Copy its public firebaseConfig object into `github/firebase-config.js` (replace `null`). This is web-app configuration, not a service-account key.
3. In Authentication, enable Email/Password and Google. Add `swera-asif.github.io` to Authorized domains. Choose your support email for Google.
4. Create a Cloud Firestore Standard database. Start in production mode. Publish the contents of `firestore.rules` in its Rules tab before using the portal.
5. Run `node scripts/build-github.mjs`, commit the changed files, and push. GitHub Pages publishes `main` → `/docs`.
6. Test registration, sign-out, direct dashboard access while signed out, and separation between two test accounts. Firebase integration requires a configured project for these live checks.

Google sign-in opens the Google account chooser. A first-time user completes their FireCam profile. Email/password registration creates an account and profile. Password reset is included. No ChatGPT account is needed on the GitHub Pages version.

Phone/SMS sign-in is not enabled in this release. It needs separate provider configuration, anti-abuse controls, and potentially billing. Do not turn on billing or SMS without the owner's decision.

Reference: https://firebase.google.com/docs/auth/web/start
Reference: https://firebase.google.com/docs/firestore/security/rules-conditions
