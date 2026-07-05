# Codebase Context — TinyApps

## Code Structure

```
src/
├── WildstoneScentAura/       # first app: web AR client-demo experience
│   ├── index.html
│   ├── ...                   # per-app internal structure TBD as it's built
├── {{NextApp}}/               # future tiny apps each get their own top-level folder
```

Each app under `src/` is self-contained — its own entry point, no forced shared build system across apps, per the "each app is self-contained" principle in `Planning/CONTEXT.md`.

## Naming Conventions

- **Folders (apps):** PascalCase, matching the app name (e.g. `WildstoneScentAura`)
- **Files (component-like/screens/renderers):** PascalCase (e.g. `SplashScreen.js`, `AuraRenderer.js`)
- **Files (logic/utilities):** camelCase (e.g. `faceTracker.js`, `cameraStream.js`)
- **Folders (categories within an app):** lowercase, plain (e.g. `screens/`, `camera/`, `aura/`)
- **Components/Classes:** PascalCase
- **Hooks/Functions:** camelCase
- **Types/Interfaces:** N/A for vanilla-JS apps (no TypeScript by default — see Patterns to Avoid); revisit per-app if a future app adopts TS
- **Variables:** camelCase
- **Constants:** UPPER_SNAKE_CASE for true constants/feature flags (e.g. `ENABLE_VIDEO_CAPTURE`)

## Patterns to Follow

- Spike the highest-risk technical unknown before building the surrounding feature (e.g., test `MediaRecorder` canvas capture on the actual target browser before building the capture UI around it).
- Define a shared data interface when multiple input sources must drive the same downstream consumer (e.g. WildstoneScentAura's face-tracker and Touch Canvas fallback both emit `{ x, y, scale, confidence }`, so the aura renderer needs only one implementation instead of one per input source).
- Build renderers/engines behind a swappable seam (e.g. `AuraRenderer.js`) when a cheaper implementation (Canvas2D) is the committed path but a more ambitious one (WebGL) might be attempted later if time/perf allows.
- {{Pattern 4 with brief explanation}}

## Patterns to Avoid

- Don't add cross-app shared framework/build tooling unless a real, repeated need emerges — each app stays self-contained.
- Don't add TypeScript by default for short-lived demo apps — type ceremony isn't worth the friction against a tight, session-based build cadence unless the app is a maintained product.
- Don't load third-party dependencies from a CDN at runtime for anything demo-critical — self-host via npm + bundler so a live demo never depends on an external network request succeeding at the worst possible moment.

## Testing Requirements

- **Automate:** deterministic/mockable logic only — state machine transitions, permission-denied → fallback branches, share-sheet trigger, and a fake-media-device happy-path smoke test (via Chromium's `--use-fake-device-for-media-stream` flags). Keep suites small (aim for 4-6 tests per app) using Playwright + `node:test`.
- **Don't automate:** visual/aesthetic quality of any canvas/WebGL rendering, real face/pose-tracking accuracy or performance, or anything depending on real mobile browser quirks (e.g. iOS Safari's `MediaRecorder`/`captureStream` behavior) — Playwright's `webkit` project is desktop WebKit and will not reproduce real mobile Safari bugs. These require hands-on testing on real devices; don't let a green automated suite stand in for it.
- Run the automated suite manually at natural checkpoints (e.g. end of a session), not gated into the deploy pipeline, so it doesn't slow down the deploy-and-test-on-a-real-phone loop that camera/canvas apps depend on.

## Key Libraries

- **Vite** — dev server + build tool for apps needing npm dependencies (e.g. bare-specifier imports); vanilla-JS template by default, no framework unless the app specifically needs one.
- **@mediapipe/tasks-vision (`FaceDetector`)** — lightweight face-detection (bounding box/landmarks), not `FaceLandmarker`/full mesh — WildstoneScentAura's tracking input; chosen to balance demo "wow factor" against bundle size/perf risk on an uncontrolled client device. WASM + model assets self-hosted, not CDN-loaded.
- **@playwright/test** — browser-mockable smoke tests (see Testing Requirements above).

## Reference Documentation

External docs and guides relevant to this codebase. Check these when working with unfamiliar APIs or debugging integration issues.

- {{library/service docs URL}} — {{what it covers}}
- {{library/service docs URL}} — {{what it covers}}

## Skills

Skills relevant when working on code in this workspace.

- **`testing-skill`** — Invoke when writing or updating tests
- **`emil-design-eng`** — Invoke for any component with interaction, animation, or motion
- **`impeccable`** — Invoke for any visual design work (typography, color, spacing, layout)
- **`interface-design`** — Run `/interface-design:init` at project start; `/interface-design:audit` before shipping UI
- **`ui-skills`** — Final Web Interface Guidelines compliance check before UI is considered done
