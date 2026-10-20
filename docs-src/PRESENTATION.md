# Presenting FireCam

## Opening explanation

“FireCam explores how camera evidence and sensor context could help a person review a home incident. This working showcase demonstrates the user journey, including uncertain evidence and false alarms. Household devices and notifications are simulated; local media tools and optional image-provider requests are functional.”

## Five-minute walkthrough

| Time | Show | Explain |
| --- | --- | --- |
| 0:00–0:45 | Home page and proposal | Product concept and proposed response workflow |
| 0:45–1:15 | Sign in, then dashboard | Managed accounts; browser-local sample records |
| 1:15–2:30 | Scenario simulator | Step through suspected fire; compare false alarm and missing evidence; no messages are sent |
| 2:30–3:15 | Cameras, floor plan and history | Search sample cameras, move a device, review an incident and export CSV |
| 3:15–4:15 | Detection lab | Inspect a local image; distinguish pixel rules from optional external AI |
| 4:15–5:00 | Voice, settings and help | Local microphone capture, preferences and delivered-versus-planned scope |

Prepare a confirmed test account before presenting instead of waiting for an email on stage. The local fallback is `npm start`, then `http://127.0.0.1:4180/#/dashboard`; Identity and provider review are unavailable on that simple local server.

## Before presenting

- Check navigation, layout and keyboard focus in the intended desktop and mobile browsers.
- Verify signup confirmation, sign-in, sign-out and recovery with a test account.
- Replay each scenario and check acknowledgement, resolution and CSV export.
- Try camera/microphone permissions, including denial and stopping capture. Use a non-sensitive image.
- If showing AI review, privately verify the key, model and quota first. Never put credentials in slides or screenshots.
- Use fictional contacts. Reset demo data in Settings if needed; the app asks for confirmation.

## Questions to expect

**Is it detecting fires in a real home?** No. The dashboard is simulated. Local image rules and optional AI are experimental aids for human interpretation.

**Does it contact emergency services?** No. Notifications and escalation steps are simulated.

**Does each account have private cloud history?** No. Identity manages accounts; demo records are shared within a browser profile.

**What works?** The website, account flows, sample incident workflow, device/contact interactions, CSV export, local media tools and optional authenticated AI review.

**What comes next?** Device connections, validated detection, private cloud history, real notifications, monitoring integration and broader acceptance testing.
