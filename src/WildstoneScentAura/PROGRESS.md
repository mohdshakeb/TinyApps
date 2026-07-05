# Wildstone Scent Aura — Progress Log

Read this + `Planning/CONTEXT.md` (Architecture Decisions) before starting a new session — together they should be enough to resume without re-deriving context. Full plan: `Planning/WildstoneScentAura_Plan.md`.

---

## Session 0 — Repo, deploy pipeline, camera hello-world

**Date:** 2026-07-05

**Done:**
- Initialized git in `TinyApps/`, connected to `https://github.com/mohdshakeb/TinyApps.git`, pushed initial scaffold + Session 0 work (2 commits on `main`).
- Scaffolded Vite vanilla-JS template at `src/WildstoneScentAura/`.
- Installed `@mediapipe/tasks-vision`; self-hosted its WASM runtime (`public/mediapipe/wasm/`) and the `blaze_face_short_range.tflite` face-detector model (`public/mediapipe/models/`) rather than loading from a CDN — see `Planning/CONTEXT.md` decision on this.
- Built `src/camera/cameraStream.js` (getUserMedia wrapper) and `src/tracking/faceTracker.js` (FaceDetector init + throttled `detectForVideo` loop via rAF gating, ~15Hz).
- `src/main.js` wires camera → tracker → console-logs detections; minimal dark-themed full-bleed `index.html`/`styles/main.css`.
- Added `vercel.json` (Permissions-Policy: camera, immutable caching on `/assets` and `/mediapipe`).
- Verified locally: `npm run build` succeeds, `npm run dev` serves `index.html` and both mediapipe static assets with HTTP 200.

**Real data point worth flagging:** the self-hosted WASM+model payload is **~22MB** (`vision_wasm_internal.wasm` ~11MB + `vision_wasm_nosimd_internal.wasm` ~10MB + ~230KB model — both SIMD variants are shipped since we don't know ahead of time which one a given browser needs). The initial JS/CSS/HTML shell itself is small (~138KB uncompressed, ~42KB gzip) and well under the <3MB budget, but this confirms the tension flagged in `Planning/CONTEXT.md`: the tracking chunk itself is nowhere near "3MB total." Currently `main.js` imports `faceTracker.js` eagerly (static import), which pulls the mediapipe JS wrapper (~137KB) into the main bundle — that's fine for this hello-world page, but **must become a dynamic `import()` gated behind the splash screen** once Session 3 builds the real state machine, so the 22MB fetch only starts after the user taps past splash, not on initial page load.

**Vercel connected** — GitHub repo imported to project `mohdshakebs-projects/tiny-apps`, Root Directory set to `src/WildstoneScentAura` in dashboard settings. Local folder linked via `vercel link` (creates `.vercel/project.json`, gitignored). Production URL: **https://tiny-apps.vercel.app**

**404 troubleshooting:** first real-device test showed "404 NOT_FOUND". Root Directory was confirmed correct in the dashboard, so authenticated the Vercel CLI (`npx vercel login` + `vercel link`) and inspected directly:
- `vercel inspect <url> --logs` on the latest deployment (commit `95c3edd`) showed a clean, successful build: `npm install` → `vite build` → `dist/index.html` + assets → "Deployment completed".
- Server-side `curl` checks against `https://tiny-apps.vercel.app/` all confirm 200: index.html serves the correct markup, `/mediapipe/wasm/vision_wasm_internal.wasm` and `/mediapipe/models/blaze_face_short_range.tflite` both reachable, and the `Permissions-Policy: camera=(self)` header from `vercel.json` is present.
- Conclusion: the deployment itself is healthy. The 404 was very likely from testing a stale/cached state on the phone (e.g. hitting it before the deployment finished propagating, or a cached error page) rather than an actual config problem. **Not yet confirmed on a real phone with a fresh load** — that's the next step before Session 0 can be marked done.

**Added an on-screen debug overlay** (`src/utils/debugOverlay.js`, toggled via `?debug=1`) that mirrors console.log/warn/error plus window errors into a visible on-page panel — removes the need for a USB cable + desktop devtools during real-device testing for the rest of this project. First version didn't render on real mobile WebKit due to the CSS `inset` shorthand; fixed by using explicit `top/left/right/bottom` instead.

**Session 0 — DONE, confirmed on real device:**
- Tested on Android, both Chrome and Brave, at `https://tiny-apps.vercel.app`: camera permission prompt appears, live feed renders correctly on both browsers.
- Tested with `?debug=1`: on-screen panel shows continuous `[faceTracker] detections:` lines as the face moves in frame — confirms the full pipeline (self-hosted WASM → GPU-delegate FaceDetector → per-frame detection) works end-to-end on a real device, not just locally.
- `delegate: 'GPU'` works fine on this device — no CPU-delegate fallback needed so far, but this is only one Android device; broader devices come in Session 2's perf spike and Session 6's compatibility pass.
- **Not yet tested on iOS** — first iOS real-device test is Session 1 (video-capture spike), which needs a real iPhone anyway.

**Sequencing change:** Session 1 (iOS video-capture spike) is deferred — no iPhone available right now. Reordered to do the Android half of Session 2 (face-detection perf) first instead, since Android is available. Session 1 and the iPhone half of Session 2 remain open until an iPhone is available; nothing else in the plan is blocked by this since capture-flag/UI work (Session 5) already only wires video capture conditionally on Session 1's result.

---

## Session 2 (Android half) — face-detection perf spike

**Date:** 2026-07-05

**Done:**
- Built `src/utils/perfMonitor.js`: tracks main-thread rAF frame rate and rolling-average `detectForVideo()` latency, reports via `console.log` once/sec (visible in the `?debug=1` overlay).
- Wired into `faceTracker.js`'s detection loop: `tickFrame()` called every rAF tick (measures overall main-thread FPS, not just detection-loop rate), latency measured around each `detectForVideo()` call.

**Real-device result:** on Android, `mainThreadFps` swung between 30-57 (should be ~60) with `avgDetectLatency` at 20-35ms, using nothing but the camera feed — no aura yet. That's ~300-500ms/sec of main-thread blocking from `detectForVideo()` alone at the ~15Hz throttle. Go/no-go call: **main-thread-only is not sufficient** — this would show up as visible stutter once Session 4 adds a 60fps particle system on top. Full reasoning logged in `Planning/CONTEXT.md`.

**Built the Worker offload (pulled forward from "conditional" to committed, now):**
- `src/tracking/faceTrackerWorker.js` — runs `FilesetResolver`/`FaceDetector` init and `detectForVideo` entirely inside a module Worker.
- `src/tracking/faceTracker.js` — rewritten: main thread now only captures `createImageBitmap(videoEl)` per detection tick and transfers it to the worker (transferable, zero-copy); receives detection results back via `worker.onmessage`. A `busy` flag prevents queueing more frames than the worker can keep up with.
- `perfMonitor.js`'s `avgDetectLatency` now measures worker round-trip time (postMessage → worker inference → postMessage back), not raw inference time — a fair real-world number since none of it blocks the main thread anymore.
- Side benefit confirmed in build output: main entry JS chunk dropped from ~139KB to ~3.5KB — `@mediapipe/tasks-vision`'s JS wrapper now bundles into the worker chunk (`faceTrackerWorker-*.js`, ~135KB), which only loads when the worker is instantiated.
- Verified locally: `npm run build` succeeds, dev server serves both the main bundle and the worker module correctly (HTTP 200).

**Debug-overlay bug found during real-device retest:** `mainThreadFps`/`avgDetectLatency` only appeared in the `?debug=1` panel when the camera was fully covered — otherwise they never showed. Root cause: `main.js` logged the full detections array on every detection tick (`if (detections.length > 0) console.log(...)`, up to ~15Hz whenever a face was in frame). The debug overlay mirrors `console.log` into a 50-entry scrolling panel pinned to the bottom, so that per-frame spam constantly buried/scrolled past `perfMonitor`'s once-per-second stats line. With the camera covered, `detections.length` was always 0, so no spam competed with the perf line — which is why covering the camera "fixed" it. Fixed by only logging on detection-count transitions instead of every tick (`src/main.js`).

**Second retest surfaced two more real-device issues, both now fixed in code:**
- **Debug overlay swallowed real error text:** `debugOverlay.js`'s console mirror did `JSON.stringify(err)` on `Error` objects, which always yields `"{}"` (Error's `message`/`stack`/`name` are non-enumerable) — so real errors were invisible in the on-screen panel. Fixed to special-case `Error` instances as `` `${name}: ${message}` ``.
- **Worker-init failures hung silently instead of erroring:** `initFaceTracker()`'s promise only had a `resolve` path (on a `'ready'` message) — no `reject`, no `worker.onerror`. On Chrome, the worker's `FaceDetector.createFromOptions(...)` (GPU delegate) apparently never completes/never posts `'ready'`, so `boot()` hung forever at "Loading face tracker…" with nothing logged. Added a `worker.onerror` handler plus a `try/catch` in `faceTrackerWorker.js`'s `init()` that posts an `'init-error'` message back, so failures now surface as a real caught error in `main.js`'s `boot()` instead of hanging.
- **Separately, on Brave:** camera permission was denied with no prompt shown at all (previously worked in Session 0) — this looks like a persisted site-permission/Shields block on the device rather than a code issue, but couldn't be confirmed since the debug overlay was hiding the real error message (see above). Needs retesting now that the overlay actually shows error text.

**Real error surfaced the actual bug — Chrome: `Error: ModuleFactory not set`.** Traced into `@mediapipe/tasks-vision` 0.10.35's own bundle: its WASM glue loads via `importScripts()`, which throws `TypeError` inside an ES-module Worker (spec disallows it there). The library catches that and falls back to a dynamic `import()`, but that runs in its own module scope, so the glue script's top-level `var ModuleFactory = ...` never attaches to the worker's global `self.ModuleFactory` the way a classic script would — the library's subsequent `self.ModuleFactory` check then fails. Net: `@mediapipe/tasks-vision` 0.10.35's WASM loading is fundamentally incompatible with `type: 'module'` workers.

**Fix:** dropped `{ type: 'module' }` from the `new Worker(...)` call in `faceTracker.js`. No `vite.config` exists in this project, so Vite's default `worker.format: 'iife'` already applies — confirmed via `npm run build` that `faceTrackerWorker.js` bundles into a self-contained IIFE (no `import`/`export` statements) rather than an ES module chunk. Running it as a classic worker means `importScripts()` works as the mediapipe glue expects.

**Brave: `NotAllowedError: Permission denied`, no prompt shown at all.** This is browser/device permission state, not a code issue — no prompt means Brave already has a persisted "block" decision for this origin from earlier testing. Needs the user to reset Camera to "Ask"/"Allow" in Brave's site settings (tap address bar → site info → Permissions) and reload; nothing to fix in the app for this one.

**Retest on Chrome (Android) confirms the fix — Session 2 (Android half) DONE:**
- Tracker now initializes past "Loading face tracker…" with no error.
- `mainThreadFps` holds steady at **60** with the Worker offload live. `avgDetectLatency` fluctuates ~20-31ms per call — expected variance, and no longer a concern since that cost is isolated to the worker thread and doesn't block the main-thread render loop (the whole point of the offload). Go/no-go: **Worker offload confirmed sufficient on real Android hardware.**

**Still open (not blocking further sessions):**
- Brave on this Android device still denies camera permission with no prompt (persisted site-permission/Shields state from earlier testing, not a code issue) — needs the user to reset it in Brave's site settings. Chrome is confirmed working, which is sufficient to proceed.
- iPhone half of Session 2 (perf spike) and all of Session 1 (iOS video-capture spike) — still deferred until an iPhone is available, per the sequencing change logged in Session 0. Nothing else in the plan is blocked by this.

---

## Session 3 — State machine + screen shell

**Date:** 2026-07-05

**Done:**
- `src/state/appStateMachine.js` — pure, DOM-free FSM (`createStateMachine`/`States`) implementing the full state graph from `Planning/WildstoneScentAura_Plan.md` (SPLASH → PERMISSION_REQUEST → CAMERA_INITIALIZING → LIVE_AURA → CAPTURE_PREVIEW → SHARE, plus the FALLBACK_TOUCH_CANVAS branches from PERMISSION_REQUEST/CAMERA_INITIALIZING/LIVE_AURA). Unknown events are a no-op; an `onTransition({ from, to, event })` callback drives rendering.
- `src/screens/` — `SplashScreen.js`, `PermissionScreen.js` (shared loading UI for both PERMISSION_REQUEST and CAMERA_INITIALIZING, swapping status text), `LiveAuraScreen.js` (shows the camera feed + a debug bounding-box canvas overlay, replacing the old console-log-only detection output), `TouchCanvasFallbackScreen.js` (placeholder copy for now — the actual finger-drag aura interaction is Session 4's job, per the plan's touch/aura shared-anchor-interface decision).
- `src/main.js` rewritten as the composition root: owns the FSM instance, mounts/unmounts the screen for the current state, and triggers the async side effects each state needs (`requestCamera()` on PERMISSION_REQUEST, `loadTracker()` on CAMERA_INITIALIZING), feeding results back via `machine.send(...)`. Also wires the camera track's `ended` event to `CAMERA_LOST`, so the camera dying mid-session now correctly falls back to Touch Canvas instead of leaving a frozen frame on screen.
- `index.html`/`styles/main.css` updated: removed the old static `#status` div (superseded by `PermissionScreen`), camera feed now hidden until `LIVE_AURA` mounts it, added screen/button/spinner styling (dark tinted background, electric-blue accent per the Edge variant, no purple gradients/pure black/animations over 300ms).
- **Tests, both passing:**
  - `tests/e2e/stateMachine.spec.js` — 9 cases via `node --test` (`npm run test:unit`), covering the happy path, all three fallback triggers (denied/init-failed/camera-lost), the capture/share loop, Touch Canvas reusing that same loop, unknown-event no-ops, and the `onTransition` payload shape.
  - `tests/e2e/fallback.spec.js` — Playwright test (`npm run test:e2e`) driving the real UI: clicks Start with no camera permission granted and no fake-device flag, asserts the Touch Canvas screen becomes visible. In this sandbox the browser has no camera device at all, so the actual error was `NotFoundError` rather than `NotAllowedError` — same catch-all path, confirms `requestCamera()`'s fallback isn't permission-error-specific.
  - Added `@playwright/test` as a devDependency + `playwright.config.js` (ignores `stateMachine.spec.js` so the two test runners don't collide over the same folder); `.gitignore` updated for `playwright-report`/`test-results`.
- Manually verified visually (desktop, via a Playwright screenshot script, not committed): Splash and Touch Canvas Fallback screens both render as intended.

**Real-device retest (Android) — Session 3 DONE:**
- Splash → Start → Live Aura navigates correctly; debug bounding-box overlay draws over the live camera feed accurately enough to confirm tracking is working end-to-end through the new screen shell.
- Forced-deny path also confirmed: denying/losing the camera lands cleanly on the Touch Canvas Fallback placeholder instead of hanging or crashing.
- iPhone confirmation still pending (no iPhone available yet, same standing gap as Sessions 1-2).

**Not yet done / carried forward:**
- `LiveAuraScreen`'s bounding-box coordinate mapping is an approximation (ignores the `object-fit: cover` crop offset) — fine for a debug overlay, but Session 4's real aura anchor will need exact cover-crop math.
- Capture/Share screens and the Touch Canvas drag interaction are intentionally not built yet — Sessions 4 and 5.

---

## Session 4 — Canvas2D aura v1 (Wildstone Edge)

**Date:** 2026-07-05

**Done:**
- `src/utils/coverCrop.js` — exact `object-fit: cover` math (`mapCoverPoint`, `mirrorX`): uniform scale = `max(displayW/videoW, displayH/videoH)`, centered crop offset, then the horizontal mirror flip that `#camera-feed`'s CSS `scaleX(-1)` requires. Replaces the approximate independent-x/y-scale mapping carried forward from Session 3.
- `src/tracking/faceAnchor.js` — `detectionsToAnchor()` converts a MediaPipe `FaceDetector` result into the shared anchor shape `{ x, y, scale, confidence }` (x/y normalized 0-1 in display space) using `coverCrop.js`. Takes `detections[0]` (single-face only; picking the highest-confidence box among multiple faces is explicitly Session 9 scope, not duplicated here). `scale` is derived from face-box width relative to a `REFERENCE_FACE_FRACTION` (0.35) tuning constant, clamped to [0.7, 1.6] — **not real-device calibrated yet**, expect this needs adjusting once seen on a phone.
- `src/aura/particleSystem.js` — generic, variant-agnostic particle pool: emits particles at `variant.emissionRate * confidence` per second from the anchor position, applies velocity+drag+life aging each frame, culls dead particles. Only touches the variant via `createParticle`/`drawParticle`, so later Red/Intense Black variants reuse this file unchanged.
- `src/aura/EdgeVariant.js` — Wildstone Edge look: each particle is a short jagged 2-4 segment polyline (a lightning-arc fragment) shot outward from the anchor at a random angle, electric-blue palette (`#e8faff` → `#2f8fe0`), 0.28-0.55s life. Particles are spawned at the anchor's *current* position and then drift independently, so fast anchor movement leaves a trail of past bursts behind it for free — satisfies the PRD's "trailing wisps" motion-inertia requirement without dedicated trail-tracking code.
- `src/aura/AuraRenderer.js` — the swappable Canvas2D renderer behind the seam named in `Planning/CONTEXT.md`. Runs its own rAF loop (not tied to the ~15Hz detection rate); `setAnchor()` just updates a target and every frame lerps the rendered anchor 22% toward it, so motion reads as smooth 60fps despite throttled detection input. Uses `globalCompositeOperation = 'lighter'` once per frame (not per-particle `shadowBlur`, which is known-expensive on mobile Canvas2D) for a cheap additive glow.
- `src/touchCanvas/touchAuraController.js` — Pointer Events (`pointerdown`/`pointermove`/`pointerup`/`pointercancel`) on the fallback canvas, emitting the same anchor shape (`scale: 1`, `confidence: 1` while dragging, neutral anchor with `confidence: 0` on release). Gated on an internal `active` flag since `pointermove` fires on mouse hover even without a button pressed — without that guard, a desktop mouse would drive the aura just by hovering, not dragging.
- `LiveAuraScreen.js` now mounts an `.aura-canvas` fed by `AuraRenderer`+`EdgeVariant`+`faceAnchor.js`; the old always-on debug bounding-box canvas is now gated behind `?debug=1` (using the same exact cover-crop math) so the demo view only shows the aura, not a green debug rectangle.
- `TouchCanvasFallbackScreen.js` rebuilt: full-bleed `.aura-canvas` (same renderer/variant) driven by `touchAuraController.js`, with the "Camera unavailable" copy repositioned to a `pointer-events: none` hint banner at the top so it no longer blocks the drag surface. `touch-action: none` added on `.aura-canvas` so mobile browsers don't intercept single-finger drags as scroll/rubber-band gestures.
- `main.js` needed **no changes** — `screen.drawDetections(detections)` keeps the same call signature; anchor derivation and rendering are fully encapsulated inside the screen modules.

**Verification so far (not yet real-device):**
- `npm run build` succeeds; `npm run test:unit` (9/9) and `npm run test:e2e` (fallback test) still pass unmodified.
- Ad-hoc Playwright smoke check (written, verified, then discarded — not part of the committed suite, since the plan's testing strategy explicitly excludes automating aura visual quality): simulated a mouse drag across the Touch Canvas fallback and read back the canvas's pixel buffer — confirmed non-transparent pixels are actually painted, i.e. the drag → anchor → renderer → particle → draw pipeline works end-to-end in a real browser engine, not just at the unit level.

**Real-device retest (Android):**
- **Perf confirmed:** `mainThreadFps` holds steady at 60 with the aura's rAF particle loop running alongside the Worker-offloaded face detector — no regression from Session 2's concern that this combination would surface main-thread contention.
- **Visual bug found:** the aura sat directly *on* the face rather than around it. Root cause: `EdgeVariant.createParticle` spawned every particle at the anchor's exact center point (`originX, originY`) — with the PRD calling for particles "emitting outwards behind or around the coordinate center," spawning them at dead-center reads as sitting on the face instead of framing it.
- **Fix:** `EdgeVariant.createParticle` now spawns each particle on a ring around the anchor (`RING_RADIUS_FRACTION = 0.18` of `min(canvas width, height)`, scaled by `anchor.scale`) and continues the jagged arc radially outward from there, instead of from dead-center. Required threading `width`/`height` through `particleSystem.js`'s call to `createParticle` so a variant can size a spawn radius relative to the canvas. Rebuilt, unit suite still green (9/9), pushed as a follow-up commit — **not yet re-confirmed on device.**

**Retest of the ring-spawn fix (Android) — confirmed good, no further changes requested.** The aura now frames around the face rather than sitting on it; `RING_RADIUS_FRACTION = 0.18` and `REFERENCE_FACE_FRACTION = 0.35` are both fine as-is for now. **Session 4 is done** on Android; iPhone testing remains part of the standing deferred-until-hardware-available gap from Sessions 1-2. Further visual tuning (if any) is Session 7's explicit job ("Visual polish + WebGL stretch decision"), not carried forward as an open item here.

---

## Session 5 — Capture + share (snapshot-only)

**Date:** 2026-07-05

**Done:**
- `src/capture/captureFeatureFlags.js` — `ENABLE_VIDEO_CAPTURE = false`. Session 1 (iOS `MediaRecorder` spike) still hasn't run (no iPhone available yet), so per the plan's own fallback rule this session ships snapshot-only; `videoCapture.js` is deferred until that spike sets this flag from real evidence.
- `src/capture/snapshotCapture.js` — composites the live view (mirrored, cover-cropped video frame, if any + the aura canvas) into an offscreen canvas via `canvas.toBlob`. Reuses `coverCrop.js`'s cover-fit math (extended with a new `coverDrawParams` export for the `drawImage` 9-arg source rect) so the capture pixel-matches what's on screen — same math already trusted for face-anchor tracking.
- `src/ui/BrandOverlay.js` — draws the PRD's watermark (`#IntensifyYourGame` / `WILDSTONE EDGE`) onto the capture canvas, translucent, bottom-left (the PRD's other option, top-right, risks colliding with a front-camera notch on an unknown device).
- `src/share/shareSheet.js` — `navigator.share`-first (native sheet, matches the demo's actual mobile target), falls back to a download-link `<a>` click when Web Share or file-share support is absent.
- `src/screens/CapturePreviewScreen.js` (Retry/Use Photo) and `src/screens/ShareScreen.js` (Share/Done), styled per the workspace's dark theme.
- Added a circular capture button (PRD: "circular Capture button") to both `LiveAuraScreen.js` and `TouchCanvasFallbackScreen.js` — each screen owns its own `capture()` call since each has direct access to its own video/canvas refs; `main.js` stays a thin composition root, only receiving the resulting `Blob` via `onCapture`, storing it as an object URL, and driving the FSM.
- **Fixed a state-machine gap while wiring this in:** `CAPTURE_PREVIEW`'s `RETRY` and `SHARE`'s `DONE` previously pointed unconditionally at `LIVE_AURA`, which would send a camera-denied user (captured from the Touch Canvas fallback) into a state that needs a camera they don't have. `appStateMachine.js` now tracks a `captureOrigin` (whichever of `LIVE_AURA`/`FALLBACK_TOUCH_CANVAS` the `CAPTURE` event fired from) and both `RETRY`/`DONE` return to it via a `RETURN_TO_ORIGIN` sentinel in the transition table, instead of a second hardcoded target. All prior FSM tests still pass unchanged; added two new ones for the fallback-origin case.

**Verified so far (desktop/headless, not yet real-device):**
- `npm run build` succeeds; `npm run test:unit` (13 `node:test` cases) and `npx playwright test` (3 e2e specs, including a new `shareSheet.spec.js` covering fallback capture → preview → share → back-to-fallback, and a retry case) all green.
- Playwright screenshot smoke-check of the composited capture (drag-shaped aura + watermark) confirms the composite pipeline visually: ring particles render correctly, watermark text is legible bottom-left, buttons don't overlap the image.

**Not yet real-device confirmed** (same gap pattern as Session 4 — this needs an actual phone, not desktop headless Chromium):
1. Whether `navigator.share` actually engages the native OS share sheet on real Android/iOS Safari (headless Chromium here has no file-share support, so only the download-link fallback path has been exercised).
2. Whether the capture composite (video + aura canvas + watermark) looks right against a *real face*, not a synthetic drag — this is the same "not automatable" visual-quality gap Session 4 flagged for the aura itself.
3. The camera-branch capture path specifically (`LiveAuraScreen`'s `capture()`, which mirrors+cover-crops a real `<video>` frame) has not been exercised at all yet — only the fallback branch was tested here, since headless Chromium in this repo's Playwright config has no fake camera device wired up.

**Next:** real-phone retest per the plan's own Session 5 verification step (walk the full journey twice — once via camera, once via forced-deny fallback — through to a successful share/download) before marking Session 5 done. Session 6 (broad device compatibility pass) is next after that.

**Real-device retest: camera-branch capture confirmed working.** First real-phone check confirmed the camera-branch capture (composite video frame + aura + watermark → share) works end-to-end.

**Scope correction from that retest:** capture was never meant to be reachable from the Touch Canvas fallback — that screen's job is purely to convey "camera required" (with the finger-drag aura as visual insurance, not a capture-worthy experience). Removed the capture button and its wiring from `TouchCanvasFallbackScreen.js`; `FALLBACK_TOUCH_CANVAS` now has no outgoing transitions in `appStateMachine.js` (capture is only reachable from `LIVE_AURA`). Since only one branch can reach `CAPTURE_PREVIEW` now, the `captureOrigin`/`RETURN_TO_ORIGIN` mechanism added earlier this session for exactly this multi-branch case was no longer needed — reverted `RETRY`/`DONE` back to a plain hardcoded `LIVE_AURA` target, and simplified the FSM back to a flat lookup table. Updated `stateMachine.spec.js` and `shareSheet.spec.js` (now asserts no capture button renders on the fallback screen) to match; `npm run test:unit` (9/9), `npx playwright test` (2/2), and `npm run build` all still green.
**Still open:** `navigator.share`'s actual native-sheet behavior and the composite-against-a-real-face visual quality (items 1-2 above) remain to be confirmed; item 3 is now resolved and superseded by this scope correction.
