# Accounts, sync and family push: one-time setup (free)

FireCam runs in **local mode** until a Supabase project is connected: everything is saved on the phone, and family members cannot receive alerts on their own phones. Connecting Supabase (free tier) turns on accounts, sync between devices, home sharing with invite codes, and free Web Push to every family phone. Nothing in this setup costs money. Do not turn on billing anywhere.

## 1. Create the Supabase project (about 5 minutes)

1. Go to https://supabase.com and sign in with GitHub or email (Swera's account).
2. **New project** → organisation: your personal one → name `firecam` → generate a strong database password and keep it in a password manager → region: Singapore or Mumbai (closest to Pakistan) → **Free** plan → Create.
3. When the project is ready, open **SQL Editor** → **New query**, paste the whole contents of [`supabase/migrations/0001_firecam.sql`](../supabase/migrations/0001_firecam.sql) and press **Run**. It should finish with "Success. No rows returned".
4. **Authentication → Providers → Email**: keep *Enable Email provider* on. Leave *Confirm email* on (users confirm with a link; this is free).
5. **Authentication → URL Configuration**: set *Site URL* to `https://firecam-showcase.netlify.app` and add `https://firecam-showcase.netlify.app/#/login` and `http://localhost:4180/#/login` to *Redirect URLs*.
6. **Project Settings → API**: copy
   - *Project URL* (looks like `https://abcdefgh.supabase.co`)
   - *anon public* key (safe to publish; it is shipped to browsers)
   - *service_role* key (**secret**; never commit it, never put it in the app)

## 2. Give the keys to Netlify

In the Netlify site **firecam-showcase → Site configuration → Environment variables**, add:

| Variable | Value | Secret? |
| --- | --- | --- |
| `SUPABASE_URL` | Project URL | no |
| `SUPABASE_ANON_KEY` | anon public key | no |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **yes** |
| `VAPID_PUBLIC_KEY` | already set | no |
| `VAPID_PRIVATE_KEY` | already set | yes |
| `VAPID_SUBJECT` | already set (`mailto:` address) | no |

Or from a terminal logged in as Swera:

```bash
npx netlify-cli env:set SUPABASE_URL https://YOURPROJECT.supabase.co --site d9ce5bb1-034c-493f-8dfc-2b6f41019e98
```

```bash
npx netlify-cli env:set SUPABASE_ANON_KEY YOUR_ANON_KEY --site d9ce5bb1-034c-493f-8dfc-2b6f41019e98
```

```bash
npx netlify-cli env:set SUPABASE_SERVICE_ROLE_KEY YOUR_SERVICE_ROLE_KEY --secret --site d9ce5bb1-034c-493f-8dfc-2b6f41019e98
```

Then **Deploys → Trigger deploy → Clear cache and deploy site**. The build log prints `cloud configured, push configured` when the keys are picked up.

The VAPID keys (for Web Push) were generated on 2026-10-23 and are already stored in the Netlify environment. They never need to change unless the private key leaks; regenerate with `node -e "console.log(require('web-push').generateVAPIDKeys())"` inside `showcase/`.

## 3. Check it works

1. Open the live site, **Create a free account**, confirm the email, sign in. Settings → Account should show your email.
2. Complete setup on phone A. Settings → Account → turn on *Alerts on this phone even when FireCam is closed* and allow notifications.
3. On phone B, create a second account, then Family → **Join with a code** using the code from phone A's Family → **Invite someone**.
4. On phone A press **Test my alerts**: only phone A rings (tests stay on your own phone). Play a smoke-alarm sound near phone A with listening on: phone B gets a push notification within a few seconds and, if FireCam is open, its own alarm screen. Either phone can press **It's a false alarm**; the other one goes quiet.

## What is stored where

- `homes.data`: home name, address, country, rooms, family contacts, last test date, setup flag. One row per home, shared by all members.
- `alerts`: every alert, shared by all members, delivered live through Supabase Realtime.
- `push_subscriptions`: one row per device that turned on background alerts.
- Theme, language, large-text and the listening switch stay per device.
- Practice-mode sample data never leaves the device.

Row-level security means a signed-in user can only read or change the homes they are a member of. The service_role key is used only by the Netlify push function to look up the devices of a home after verifying the caller's token and membership.

## Limits of the free tiers (plenty for a family)

- Supabase Free: 500 MB database, 50,000 monthly active users, 200 concurrent realtime connections, pauses after 7 days without any request (the first visit after a pause wakes it in about a minute).
- Netlify Free: 125,000 function calls a month. One alert sends one call.
- Web Push: free, no quota, works on Android Chrome/Edge/Firefox and desktop browsers. On iPhone it works only after the site is added to the Home Screen (iOS 16.4+).
