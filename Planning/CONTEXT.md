# Planning Context — TinyApps

## What Is TinyApps

TinyApps is a container for multiple small, self-contained web apps and experiments — client demos, one-off tools, quick builds. Each app lives in its own subfolder under `src/`; there's no shared framework forced across them. The first app being built is **Wildstone Scent Aura**, a web AR client-demo experience for the Wildstone deodorant brand.

## Tech Stack

- **Framework:** Per-app choice. Wildstone Scent Aura: Vanilla HTML5/CSS3/JS + Canvas/WebGL — no heavy framework, to keep it demo-fast and light.
- **Target:** Mobile-first responsive web, running on the client's own device (unknown make/model) — treat as broad-compatibility, not a single controlled device.
- **Storage:** None for demo apps — client-side only, no backend.
- **Deploy:** Vercel, per app, via a GitHub repo connected through Vercel's git integration (Root Directory set per-app, e.g. `src/WildstoneScentAura`).

## Current Priorities

1. Ship the Wildstone Scent Aura demo (Wildstone Edge variant, fully polished) within a **1-month timeline**, built progressively by Claude Code across discrete sessions. Real iOS and Android devices are available for hands-on testing — front-load the two highest-risk unknowns (iOS video-capture reliability, real-device face-tracking perf) before investing in polish. Full session-by-session plan: `Planning/WildstoneScentAura_Plan.md`.
2. Establish a repeatable pattern for adding new tiny apps to this collection (see `src/CONTEXT.md` Code Structure).
3. TBD
4. TBD

## Architectural Principles

- Each app is self-contained under `src/<AppName>/` — no cross-app shared framework or build system unless a real need emerges.
- Prefer vanilla browser-native tech over heavy frameworks to keep apps quick to build and light to load.
- Client-demo apps default to the PRD's stated performance/compatibility budget (not a relaxed one) whenever the demo device isn't controlled by us — see Wildstone decisions below.
- Spike the highest-risk technical unknown before building the full feature around it (e.g., test capture/recording APIs on target browsers before investing in the surrounding UI).

## MVP Features

_Wildstone Scent Aura (first app in this collection):_

1. **Camera-based aura visual** — Lightweight face-detection-driven WebGL/Canvas particle aura, Wildstone Edge variant only for the demo.
2. **Capture** — Snapshot capture (`canvas.toDataURL`) confirmed reliable; video capture (`MediaRecorder`) only if the iOS Safari spike proves it works.
3. **Touch Canvas fallback** — Minimal-fidelity interactive fallback if camera access fails live during the demo.

## User Flow

```
QR/link → Splash + camera permission request → Aura experience loop (Wildstone Edge)
   → Capture (snapshot, or video if spike passes) → Share via Web Share sheet
(If camera denied/fails at any point → Touch Canvas fallback)
```

## Feature Specs

- **Wildstone Scent Aura** — full PRD at `docs/Wildstone_Scent_Aura_PRD.md`. Scope for demo v1 narrowed to one variant (Edge) and snapshot-first capture; see Architecture Decisions for the reasoning. Full implementation plan (architecture, file structure, session-by-session sequencing, verification) at `Planning/WildstoneScentAura_Plan.md`.

## Architecture Decisions

### 2026-07-05 — Face tracking: lightweight face detection, not full mesh
**Decision:** Use a lightweight face-detection model (bounding box/landmarks) rather than a full face-mesh model for the aura's tracking input.
**Rationale:** Real tracking gives the "wow factor" a client demo needs (more than cursor/touch-driven fake tracking), but full mesh tracking is heavy on bundle size and per-frame compute. A lighter detection model is the middle ground given the demo runs on the client's own (unknown, uncontrolled) device.

### 2026-07-05 — Device target: client's own device, not a controlled one
**Decision:** Keep the original PRD performance budget (<3MB initial load, 60fps target on mid-range Android/iOS Safari) as a real constraint rather than relaxing it.
**Rationale:** The demo will run on whatever device the client picks up, not a device we rehearse on ahead of time. This is effectively the same compatibility bar as a public launch, so we can't cut corners on performance the way we could for a single controlled device.

### 2026-07-05 — Variant scope: Wildstone Edge only for v1
**Decision:** Build and fully polish only the Wildstone Edge variant (electric blue lightning/energy arcs) for the demo. Red and Intense Black are fast-follows after the demo.
**Rationale:** Narrowing scope to one variant protects build time and polish quality given there's no fixed deadline yet but the work should still be tightly scoped.

### 2026-07-05 — Capture: spike iOS MediaRecorder first, snapshot as safe fallback
**Decision:** Spike `MediaRecorder` canvas-capture on iOS Safari before committing to video capture as a demo feature. If unreliable, ship snapshot-only capture (`canvas.toDataURL`) for the demo.
**Rationale:** iOS Safari's support for capturing a composited canvas+video stream has a history of inconsistency. A capture failure live in front of a client is the worst-case failure mode, so this gets tested first, before any aura visuals are built.

### 2026-07-05 — Analytics: out of scope for demo
**Decision:** No engagement/share analytics instrumentation for the demo build.
**Rationale:** The audience is one client in a room, not a public campaign. Revisit if this moves from demo to a real public rollout.

### 2026-07-05 — Touch Canvas fallback: build as demo insurance
**Decision:** Build the Touch Canvas fallback (finger-drag aura on a gradient card) even though it doubles the interactive systems to build, and keep it minimal-fidelity rather than full parity with the camera mode.
**Rationale:** Because the demo runs on an unrehearsed client device, camera permission/hardware failure is a real live risk. Having a fallback prevents the whole demo from going dark if the camera doesn't init.

### 2026-07-05 — Build tooling: Vite vanilla-JS, not bundler-free
**Decision:** Use Vite's vanilla-JS template (no TypeScript, no framework, no Three.js) instead of plain unbundled static files.
**Rationale:** `@mediapipe/tasks-vision` is a bare-specifier npm import; without a bundler it would need to load from a third-party CDN at demo time, an unacceptable live-demo risk on an unrehearsed device. Vite's dynamic-import code-splitting also lets the multi-MB MediaPipe WASM+model chunk lazy-load after the initial splash paint, reconciling the PRD's <3MB shell budget with a genuinely heavy dependency. Vite auto-detects on Vercel with zero config.

### 2026-07-05 — Self-host MediaPipe WASM/model assets, don't load from CDN
**Decision:** Download and commit MediaPipe's WASM runtime and `blaze_face_short_range.tflite` model into `public/mediapipe/` rather than loading them from a CDN at runtime.
**Rationale:** Same live-demo-reliability reasoning as the bundler choice — a third-party CDN in the critical path is a risk we don't need to take when self-hosting is straightforward.

### 2026-07-05 — Aura renderer: Canvas2D primary, WebGL as optional stretch
**Decision:** Build the Wildstone Edge particle aura on Canvas2D as the committed path; only attempt a WebGL shader backend later if perf headroom allows, behind a swappable `AuraRenderer` seam.
**Rationale:** Canvas2D is lower-risk across an unknown client GPU/driver than raw WebGL shaders, and the device is explicitly unrehearsed.

### 2026-07-05 — Shared anchor interface for camera and Touch Canvas input
**Decision:** Both the face-tracker and the Touch Canvas fallback emit the same `{ x, y, scale, confidence }` shape; the aura/particle system consumes only this interface and never knows which input source is live.
**Rationale:** Means one aura system serves both the camera path and the fallback path, instead of building and maintaining two — meaningfully less work over a 1-month timeline.

### 2026-07-05 — Testing strategy: small Playwright + node:test suite, real-device testing for the rest
**Decision:** Automate only deterministic/mockable logic (state machine transitions, permission-denied → fallback branch, share-sheet trigger, a fake-media-device happy-path smoke test) — 4-6 tests total. Do not attempt to automate aura visual quality, real face-tracking accuracy, or iOS Safari MediaRecorder reliability.
**Rationale:** Playwright's `webkit` project is desktop WebKit, not real mobile iOS Safari — it will not reproduce the WebKit bugs the video-capture spike is specifically worried about. A green automated suite must not be mistaken for real-device validation; those risk areas require hands-on testing on the real iPhone/Android devices available for this project.

### 2026-07-05 — Deploy pipeline: git repo → GitHub → Vercel git integration
**Decision:** Initialize git in `TinyApps/`, push to a new GitHub repo, connect it to Vercel with Root Directory `src/WildstoneScentAura` and the Vite framework preset (auto-detected).
**Rationale:** Gives an automatic preview URL per push, which the session plan relies on for weekly real-device testing, over the alternative of manual `vercel deploy` CLI pushes with no git history.

### 2026-07-05 — Naming conventions: PascalCase for screens/renderers, camelCase for logic/utils
**Decision:** PascalCase for component-like/screen files (`SplashScreen.js`, `AuraRenderer.js`), camelCase for logic/utility files (`faceTracker.js`, `cameraStream.js`), lowercase plain folders for categories (`screens/`, `camera/`, `aura/`).
**Rationale:** No existing local pattern covers this app type (vanilla JS + Canvas, no framework); this aligns with the closest workspace precedent (Focal/GmmcoWorkshop's Vite projects) rather than inventing an unrelated convention.

### 2026-07-05 — Session 0 finding: self-hosted MediaPipe payload is ~22MB
**Decision:** Confirmed via actual build output (not estimate): self-hosting `@mediapipe/tasks-vision`'s WASM runtime (both SIMD and non-SIMD variants, since the correct one isn't known until runtime) plus the `blaze_face_short_range.tflite` model totals ~22MB. The initial page shell (HTML/CSS/JS, no tracker) is ~138KB uncompressed — well under budget on its own.
**Rationale/implication:** This confirms and sharpens the earlier "<3MB is the initial-shell budget, not the whole app" decision — the gap between shell and tracker is much larger than a rough estimate suggested. Reinforces that `faceTracker.js` must be dynamically imported only after the user taps past the splash screen (planned for Session 3), never eagerly bundled. Full detail in `src/WildstoneScentAura/PROGRESS.md` (Session 0).

### 2026-07-05 — Session 2 (Android) finding: main-thread detection blocks the frame rate, Worker offload built now
**Decision:** Real-device measurement (Android, camera feed only, no aura yet) showed `detectForVideo()` blocking the main thread for 20-35ms per call at the ~15Hz throttle rate — roughly 300-500ms of blocking per second, causing main-thread FPS to swing between 30 and 57 even with nothing else running. Built the Worker/OffscreenCanvas split (`faceTrackerWorker.js`) immediately rather than deferring it, moving `FaceDetector` init and `detectForVideo` entirely off the main thread; frames are captured via `createImageBitmap(videoEl)` and transferred to the worker per detection tick.
**Rationale:** This was flagged as conditional architecture in the original plan ("only if perf data shows main-thread contention") — this data point is exactly that trigger. Building it now, before Session 3's state machine and Session 4's aura renderer are built on top, avoids reworking that code later once a 60fps particle system would have made the stutter directly visible and harder to isolate. Side benefit confirmed in the build output: moving the `@mediapipe/tasks-vision` import into the worker dropped the main entry chunk from ~139KB to ~3.5KB, since the library now bundles into the lazy-loaded worker chunk instead of the main thread's JS.

### 2026-07-05 — Session 2 (Android) CONFIRMED: Worker offload fixes main-thread FPS; worker must run classic, not module
**Decision:** First real-device retest of the Worker offload surfaced two bugs, both fixed: (1) `faceTrackerWorker.js` was instantiated with `{ type: 'module' }`, but `@mediapipe/tasks-vision` 0.10.35 loads its WASM glue via `importScripts()`, which throws inside a module worker (disallowed by spec) — the library's fallback (dynamic `import()`) runs in its own module scope, so the glue's `ModuleFactory` global never got set, throwing `Error: ModuleFactory not set` at init. Fixed by dropping `{ type: 'module' }` so the worker runs classic; Vite's default `worker.format: 'iife'` already bundles the worker's ESM imports into a self-contained script, so no `vite.config` changes were needed. (2) `debugOverlay.js` was `JSON.stringify`-ing `Error` objects for its on-screen console mirror, which always yields `"{}"` (Error properties are non-enumerable) — this was hiding the real error text during diagnosis. Fixed with an `instanceof Error` special case.
**Result:** With both fixed, Chrome on Android confirms `mainThreadFps` holds steady at **60** with the Worker offload live, `avgDetectLatency` fluctuating ~20-31ms (expected — no longer blocks the main thread). **Session 2 (Android half) is done — Worker offload is confirmed sufficient.**
**Rationale/implication:** The Worker offload built in the prior entry had never actually been exercised on a real device before this — it was new code, not a regression. Brave on the same device separately denies camera permission with no prompt (a persisted site-permission/Shields state, not a code issue); Chrome's confirmation is sufficient to unblock Session 3. iPhone half of Session 2, and all of Session 1, remain deferred until an iPhone is available (per the Session 0 sequencing change) — nothing else in the plan is blocked by this.

### 2026-07-05 — Session 3: state machine + screen shell built, main.js becomes a pure composition root
**Decision:** Implemented `appStateMachine.js` as the full state graph from `Planning/WildstoneScentAura_Plan.md` (all 7 states, not just the ones with screens built so far) since the transition table is cheap and the graph shape is already fixed by prior planning — no speculative states were added beyond what's documented. `main.js` was rewritten from the old linear `boot()` function into a composition root that mounts/unmounts a screen module per FSM state and feeds async results (camera permission, tracker init) back in via `machine.send(...)`. `TouchCanvasFallbackScreen.js` is a placeholder for now — the real finger-drag interaction is deliberately deferred to Session 4, per the plan's shared-anchor-interface decision above.
**Rationale:** Keeps the FSM itself trivially testable in isolation (`node:test`, no DOM) while screens stay dumb (mount/unmount + a couple of callbacks), matching the plan's testing-strategy decision to automate only deterministic logic. Wiring the camera track's `ended` event to `CAMERA_LOST` was added here too (one line, directly in the documented state graph) so a camera dying mid-demo now degrades gracefully instead of freezing on the last frame — worth doing now since Session 4/5 will build on top of this shell and a frozen-camera bug would be much harder to isolate once the aura renderer is layered on.
**Real-device confirmation (Android):** Splash → Start → Live Aura navigates correctly with the debug bounding-box overlay drawing accurately over the live feed; the forced-deny path also confirmed landing cleanly on the Touch Canvas Fallback placeholder. **Session 3 is done** on Android; iPhone confirmation remains part of the standing deferred-until-hardware-available gap from Sessions 1-2.
