# Operations Context — TinyApps

## Infrastructure

- **Platform:** Vercel, per app. Static/Vite-built sites; no backend.
- **Build system:** Vite (per-app, where an app needs npm dependencies). Vercel auto-detects the Vite framework preset once the project's Root Directory is set to that app's folder (e.g. `src/WildstoneScentAura`).
- **CI/CD:** Vercel's git integration off a GitHub repo — push to a branch gets an automatic preview deployment URL; this is the main mechanism for getting a real-device-testable link during development.
- **Signing:** N/A — web apps only, no native app signing.
- No backend infrastructure — apps in this collection are client-side only.

## Deploy Process

### Development
1. `npm install` then `npm run dev` inside the app's folder (e.g. `src/WildstoneScentAura`) for Vite's local dev server with HMR.
2. Push to the connected GitHub repo to get a Vercel preview URL; open that URL on a **real phone**, not desktop devtools emulation, for anything camera/canvas-related — devtools emulation cannot validate real camera/tracking/capture behavior.
3. `getUserMedia` requires a secure context — `*.vercel.app` preview URLs are HTTPS by default, so this is satisfied with zero extra config.

### Release Build
1. `vite build` (or via Vercel's auto-detected build command) produces the `dist/` output.
2. Confirm the Vercel project's Root Directory and framework preset are still correctly set to the target app before promoting a deployment to production.
3. Verify `vercel.json` headers/caching (per-app, e.g. `Permissions-Policy: camera=(self)` and long-lived immutable caching on hashed asset paths) are present if the app needs them.

### Pre-release Checklist
- All tests pass
- Manual test of core user flow
- {{Platform-specific checks}}
- No debug flags or print statements in release code
- Update `docs/CHANGELOG.md`
- **WildstoneScentAura specifically:** confirm `MediaRecorder` canvas-capture spike result on iOS Safari before demo day; if unreliable, ship with snapshot-only capture. Test on an actual phone, not just desktop devtools emulation, since the demo runs on the client's own device.

## Runbook Conventions

- Runbooks go in `ops/runbooks/`
- Each runbook covers one operational task
- Format: numbered steps, no ambiguity, copy-pasteable commands
- Include "Verify" step at the end of every runbook

## Monitoring

- {{Current monitoring approach}}
- {{Future monitoring considerations}}

## Skills

Skills relevant when working on operations in this workspace.

- {{skill name}} — {{when to invoke}}
