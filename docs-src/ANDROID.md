# FireCam for Android

The Android app wraps the same web app with [Capacitor](https://capacitorjs.com) and adds what a browser cannot do: a foreground service that keeps listening for smoke-alarm beeps with the screen off, a full-screen alarm notification that rings at alarm volume and can bypass Do Not Disturb, and native push through Firebase Cloud Messaging. Everything is free: Capacitor, the Android SDK, Firebase's Spark plan and sideloading cost nothing. The only paid step, publishing on Google Play (a one-time registration fee), is optional and not required to install the APK.

Package name `app.firecam.alert` · minimum Android 8.0 (API 26) · target API 36.

## Build on your own machine

Requirements: Node 24+, JDK 21 and the Android SDK (either Android Studio, or the command-line tools with `platforms;android-36`, `build-tools;36.0.0` and `platform-tools`). Set `JAVA_HOME` and `ANDROID_HOME` (or put `sdk.dir=...` in `showcase/android/local.properties`).

```bash
cd showcase && npm ci
```

```bash
npm run android:apk
```

That runs the web build, `npx cap sync android` (copies `dist/` into the app and refreshes native plugins) and `gradlew assembleRelease`. The APK lands in `showcase/android/app/build/outputs/apk/release/app-release.apk`. For the Play Store bundle:

```bash
npm run android:aab
```

Output: `showcase/android/app/build/outputs/bundle/release/app-release.aab`.

To open the project in Android Studio instead: `npm run android:open`, then Build → Generate Signed Bundle / APK.

**Windows note.** If Gradle stops with `Unable to establish loopback connection` / `Invalid argument: connect`, your Windows user folder has a space or special character in its name (for example `C:\Users\MR. Beast`). JDK 21 puts its internal socket files under the temp folder and that path breaks it. Point the JDK at a short folder before building:

```powershell
New-Item -ItemType Directory -Force C:\Users\Public\fctmp | Out-Null; $env:JAVA_TOOL_OPTIONS="-Djdk.net.unixdomain.tmpdir=C:\Users\Public\fctmp -Djava.io.tmpdir=C:\Users\Public\fctmp"
```

### Signing

Release builds are signed with `showcase/android/keystore/firecam-release.keystore`, described by `showcase/android/keystore.properties`:

```
storeFile=keystore/firecam-release.keystore
storePassword=...
keyAlias=firecam
keyPassword=...
```

Both files are git-ignored and must never be committed. **Back them up** (password manager plus a copy of the keystore): an app signed with a different key cannot update an installed FireCam, and Google Play ties the listing to the upload key. If `keystore.properties` is missing, Gradle falls back to the debug key so local test builds still work, but those APKs cannot update a release install.

To create a fresh keystore:

```bash
keytool -genkeypair -v -keystore android/keystore/firecam-release.keystore -storetype PKCS12 -alias firecam -keyalg RSA -keysize 2048 -validity 10000
```

### Cloud features inside the app

The app bakes in the same public configuration as the website at build time. Build with the Supabase variables in the environment so accounts and sync work in the app:

```bash
$env:SUPABASE_URL="https://YOURPROJECT.supabase.co"; $env:SUPABASE_ANON_KEY="..."; npm run android:apk
```

Without them the app runs in local mode (everything on the phone, no family push), exactly like the website without keys.

## Push to the app when it is closed (Firebase Cloud Messaging, free)

Web Push does not reach a Capacitor WebView, so the app registers for FCM instead and the Netlify push function sends to both kinds of device. One-time setup:

1. https://console.firebase.google.com → **Add project** → name `firecam` → Google Analytics off → Create. Stay on the free Spark plan.
2. **Add app → Android**, package name `app.firecam.alert`. Download `google-services.json` and save it as `showcase/android/app/google-services.json` (git-ignored). Rebuild the APK.
3. **Project settings → Service accounts → Generate new private key.** Save the JSON. In Netlify (site firecam-showcase → Environment variables) add `FIREBASE_SERVICE_ACCOUNT` with the whole JSON as the value, then trigger a deploy.

Done. In the app, Settings → Account → *Alerts on this phone even when FireCam is closed* registers the device. Alerts raised by any family member's phone arrive on the "Fire alerts" channel at alarm volume.

## Permissions and what they are for

| Permission | Why | When asked |
| --- | --- | --- |
| Microphone | Listen for the smoke-alarm beep pattern. Audio is analysed on the phone and never recorded or sent. | First time you press *Start listening* |
| Notifications | The persistent "FireCam is listening" notice and fire alerts. | Same time |
| Full-screen alerts (Android 14+) | Lets a fire alert take over the screen even when locked. On sideloaded builds Android grants it by default; if an alert only appears as a banner, open Settings → Apps → FireCam → *Full-screen notifications*. | Settings only |
| Do Not Disturb access | The "Fire alerts" channel is marked to bypass Do Not Disturb. Android honours that only after you allow FireCam under Settings → Notifications → Do Not Disturb access. | Settings only |
| Camera | Reserved for the detection lab's local camera checks. | Only if you open the lab |

The listening service shows an ongoing notification with a *Stop listening* button, as Android requires. After a reboot the app cannot restart the microphone by itself (Android 14 rule); it posts a reminder to open FireCam and press *Start listening* again.

## How detection works in the app

`AlarmDetector.java` is a line-for-line port of `showcase/src/alarm.js`: 16 kHz mono capture in 32 ms windows, Goertzel energy in the 2.6 to 4 kHz band, a hysteresis tone gate, and the Temporal-Three / Temporal-Four pattern matcher that needs two repeats. The unit tests for the JavaScript version (`tests/alarm.test.mjs`) therefore describe the Android behaviour too.

When a pattern is heard:
1. If FireCam is on screen, the web layer receives an `alarm` event and shows the alert screen with siren, vibration, spoken message and the three big buttons.
2. If FireCam is in the background or closed, the service shows a full-screen "Possible smoke in Kitchen" notification on the alarm channel. Tapping it (or the screen turning on) opens FireCam, which picks up the pending alarm and continues as above. Family members are notified the moment the alert is created.

## Testing on a phone

1. Install the APK (allow "install from this source" once). Open it, press *Try without an account* or sign in, finish the three steps with *Use this phone*.
2. Home → *Test my alerts*: the phone must ring, vibrate and speak.
3. Lock the phone, play a smoke-alarm sound from another device (Settings → Advanced → *Play a smoke-alarm sound* on a second phone, or any smoke-alarm video). Within about 7 seconds the screen should light up with the alert.
4. Press *It's a false alarm*. The alert closes and appears in Alerts as a sentence.
