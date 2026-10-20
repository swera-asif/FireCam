# Netlify deployment

Production: [firecam-showcase.netlify.app](https://firecam-showcase.netlify.app/)  
Repository: [swera-asif/FireCam](https://github.com/swera-asif/FireCam)  
Production branch: `main`

## Build configuration

The repository's `netlify.toml` sets:

| Setting | Value |
| --- | --- |
| Base directory | `showcase` |
| Build command | `npm run build` |
| Publish directory, relative to base | `dist` |
| Functions directory, relative to base | `netlify/functions` |
| Node.js | `24` |

Netlify installs showcase dependencies before building. Root `npm run build` installs them with `npm ci` for reproducible local builds. Commit `showcase/package-lock.json` updates when changing dependencies.

The catch-all redirect serves the app shell for client routes. Security headers restrict scripts, media, connections and framing. Browser provider calls go through the same-origin function.

## Account configuration

Enable Netlify Identity, allow the intended registration method, and configure the site's URL and confirmation/recovery email settings. Verify signup, email confirmation, sign-in, sign-out and password recovery using a test account before a public demonstration. Registration is the main website entry point.

The repository contains no provider credentials. Visitors enter their own key in the lab, and the `ai` function forwards one image per request to the provider they choose. Only vision-capable models are listed. Availability and quota are not guaranteed.

| Provider | Endpoint called by the function | Cost handling |
| --- | --- | --- |
| OpenRouter | `openrouter.ai/api/v1` | Free-only setting filters for eligible zero-price vision models |
| Google Gemini | `generativelanguage.googleapis.com` | Depends on the visitor's project billing |
| Anthropic Claude | `api.anthropic.com/v1` | Billed to the visitor's account |
| OpenAI | `api.openai.com/v1` | Billed to the visitor's account |
| xAI Grok | `api.x.ai/v1` | Billed to the visitor's account |
| Groq | `api.groq.com/openai/v1` | Account free tier or billing |
| Mistral | `api.mistral.ai/v1` | Account free tier or billing |
| OmniRoute | The visitor's own gateway `/v1` | Depends on the gateway's routing |

Only OpenRouter publishes per-model prices, so every other provider requires the billing confirmation checkbox even when free-only is selected.

OmniRoute is a self-hosted gateway, and the function calls it from Netlify's servers. The gateway therefore needs a public HTTPS hostname on the default port, for example `https://omniroute.example.com/v1`. The function rejects `http`, IP addresses, explicit ports, credentials in the URL and local or internal hostnames, and it does not follow redirects. A default local install at `localhost:20128` cannot be reached; expose it through a hosted deployment or a tunnel, and require a gateway API key from Dashboard → Endpoints.

No outbound CSP change is needed when adding providers: the browser only calls the same-origin function, and provider requests leave from the function.

## Release procedure

1. Install dependencies with `npm --prefix showcase ci`.
2. Run `npm run check`, `npm test`, `npm run test:pages` and `npm run build`.
3. Review changes and push the intended commit to `main`.
4. Wait for GitHub checks and Netlify's production deployment. Confirm the published commit matches GitHub.
5. Open the public page, registration and a direct workspace link. Check Identity availability and confirm anonymous AI requests are rejected.
6. Run the [presentation acceptance checks](PRESENTATION.md#before-presenting).

Use Git-connected deployments for this site. A manual production deployment can be replaced by the next push to `main`. A failed build leaves the last successful deployment live; fix the issue and deploy a new commit.

Keep `.netlify/`, `.env` files, databases, provider keys and generated `dist/` output out of Git. Do not disable secret scanning to publish credentials.

## GitHub Pages

Pages serves only the redirect in `docs/`. If the production URL changes, update `github/portal-config.js`, run `npm run build:github`, then `npm run test:pages`. The redirect builder regenerates `docs/`; keep project documentation in `docs-src/`.
