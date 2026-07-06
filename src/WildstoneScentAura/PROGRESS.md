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

---

## Session 5 addendum — Video capture built ahead of the iPhone spike

**Date:** 2026-07-05

**Decision to build now, before Session 1:** still no iPhone available, but built `videoCapture.js` now rather than waiting, on the explicit understanding that desktop Safari testing is a partial substitute at best — real risk retirement still requires a real iPhone. `ENABLE_VIDEO_CAPTURE` is set `true` to allow that desktop-Safari pass; the flag's comment in `captureFeatureFlags.js` spells out that "desktop-Safari-passing" is not the same claim as "demo-safe."

**Done:**
- `src/capture/compositeFrame.js` — extracted the per-frame draw (mirrored/cover-cropped video + aura canvas + watermark) out of `snapshotCapture.js` so both a still frame and a recorded video frame are drawn identically, instead of duplicating that logic.
- `src/capture/videoCapture.js` — `startVideoCapture()` runs its own rAF loop compositing onto an offscreen canvas, feeds `canvas.captureStream(30)` into a `MediaRecorder`, picks the first supported mimeType from `['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']` (Safari only supports the mp4 entry; Chrome/Firefox/Android take a webm variant), and auto-stops at 5s (PRD: "5-second looping video") or earlier via a returned `stop()`. `isVideoCaptureSupported()` guards on `MediaRecorder`/`captureStream` actually existing, independent of the feature flag.
- `LiveAuraScreen.js` — long-press gesture (350ms threshold) on the capture button: a quick tap still triggers `captureSnapshot()` exactly as before; holding past the threshold starts a recording (button ring turns red/pulses), which ends on release or at the 5s cap, whichever comes first. Guarded against the native `click` event that still fires after a long-press release ending up double-triggering a snapshot on top of the video.
- `CapturePreviewScreen.js`/`ShareScreen.js` now render a looping muted `<video>` instead of an `<img>` when the captured blob's mimeType starts with `video/`; `shareSheet.js` now derives the right file extension (`.mp4`/`.webm`/`.png`) from the blob's mimeType instead of a hardcoded `.png`.

**Verified so far:** `npm run test:unit` (9/9), `npx playwright test` (2/2), `npm run build` all still green (none of this session's e2e coverage touches video capture directly, since headless Chromium has no fake camera device wired into this repo's Playwright config — same gap already tracked above for the camera branch generally).

**Not yet confirmed on any real device** — this is the biggest open risk in the app right now:
1. Real iPhone (the actual Session 1 spike this was built ahead of) — still not available.
2. Real Android — the device this project *does* have available for testing has not tested video capture yet (only the camera/perf/aura work in Sessions 2-4 was Android-confirmed). Since Android Chrome has long-standing solid `MediaRecorder`/webm support, this is expected to work, but "expected" isn't "confirmed."
3. Desktop Safari — informal manual test in progress as of this entry; result not yet logged.

**Next:** deploy and test on the real Android device (available now) and manually on Mac Safari before treating this as anything more than "built, not yet demo-safe." If Android fails, that's a more urgent signal than a desktop-Safari pass either way, since Android is this project's actual tested-and-working camera/perf baseline.

**Real-device retest confirms both available platforms — Session 5 is DONE (with the standing iPhone gap):**
- **Android:** confirmed working — snapshot and long-press video capture both record correctly, preview/share flow completes end-to-end on the deployed Vercel URL.
- **Desktop Safari:** confirmed working — same flow. One observation, not a bug: on a genuinely cold cache (first-ever load), the aura particles took a few seconds longer to appear than on a warm reload. Root cause is expected face-tracker warm-up (the ~22MB self-hosted WASM/model payload finishing its first parse/JIT + the `FaceDetector`'s first inference call generally being slower than steady-state), not a code defect — did not recur on subsequent loads. No fix needed; noting it here so it isn't mistaken for a regression later.
- **iPhone:** still not available. This remains the one standing gap across Sessions 1, 2, and 5 — carried forward, not blocking, exactly as previously logged.

**Session 5 (snapshot + video capture, both branches' scope as corrected above) is done.** Session 6 (broad real-device compatibility pass) is next.

---

## Session 6 — deferred; jumped to Session 7 instead

**Date:** 2026-07-05

Session 6 ("Broad real-device compatibility pass #1") explicitly needs 2+ iOS Safari devices/versions and 2+ Android Chrome tiers, which this project doesn't have (still just one Android device, no iPhone — the standing gap from Sessions 1/2/5). Rather than do a half-covered pass now, this is deferred until more devices are available, and Session 7 was done instead since it doesn't depend on a device matrix.

---

## Session 7 — Visual polish + Canvas2D vs. WebGL decision

**Date:** 2026-07-05

**WebGL decision (the plan's explicit ask for this session):** staying on Canvas2D, not building a WebGL backend. Sessions 2 and 4 already confirmed steady 60fps on real Android hardware with the Worker-offloaded face detector *and* the Canvas2D particle system running together — there's no perf headroom problem to solve, so a WebGL rewrite would only add engineering risk (shader/context-loss edge cases across an unknown client GPU) for no measured benefit this close to demo-ready. This closes out the "WebGL as optional stretch" branch of the original architecture decision.

**Applied this workspace's mandatory UI skills** (`emil-design-eng`, `interface-design`) per `CLAUDE.md`. Note: two of the four named there (`impeccable`, `ui-skills`) aren't in the current skill list — likely renamed/superseded — so used the closest available equivalents. No `.interface-design/system.md` exists (this is a single small CSS file, not a component system), and creating one now is disproportionate to what's left in the plan, so audited directly against the actual CSS instead of formally running `/interface-design:init`.

**Found and fixed a real bug, not just polish:** `AuraRenderer.js`'s `resize()` sized the canvas backing store to `canvas.clientWidth`/`clientHeight` (CSS pixels) with no `devicePixelRatio` handling — on a real 2-3x DPR phone screen this renders the aura (and the Touch Canvas fallback, which shares the same renderer) softer/more aliased than it should. Fixed by sizing the backing store to `clientWidth * dpr` and applying `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`, so every existing draw call (particle positions, stroke widths, the debug overlay) keeps working in CSS-pixel logical space unchanged — only the actual bitmap resolution goes up. Verified via a Playwright smoke test at `deviceScaleFactor: 3` (simulating a real high-DPR phone): canvas backing store correctly scales to 3x, composite still renders correctly positioned with no distortion. This also means captured snapshots/videos are now higher-resolution automatically (same `auraCanvas.width`/`height` values are what `compositeFrame.js` reads for output size) — worth a quick eye on real-device video-capture perf next time, since compositing more pixels at 30fps is marginally more expensive than before (not expected to matter, but not yet measured on real hardware post-fix).

**Smaller polish fixes:**
- Custom `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` replacing plain `ease` on button/capture-button transitions (`emil-design-eng`: built-in easings are weak; a stronger custom curve gives press feedback more snap at the same duration).
- Added `@media (prefers-reduced-motion: reduce)` for the purely decorative `recording-pulse` glow. Deliberately left the loading spinner's rotation and the aura's own face-tracked motion alone — the spinner's rotation is the only thing communicating "still loading" (removing it removes information, not just decoration), and the aura's motion is the feature itself, not chrome.

**Verified:** `npm run test:unit` (9/9), `npx playwright test` (2/2), `npm run build` all green; DPR fix visually smoke-checked per above. **Not yet confirmed on a real phone** — the DPR crispness improvement and the marginal video-capture compositing cost both need real-device eyes (Android, the one device available) before this can be called fully done.

**Real-device retest (Android) confirms the crispness win:** the aura ring visibly looks crisper than before the fix. **Still open, not yet specifically re-checked:** whether compositing more pixels during video capture (now that the canvas is DPR-scaled) has any perf cost — this wasn't part of the "ring looks crisper" check and needs its own long-press-record retest before being marked confirmed.

**Session 7 is done** (visual quality confirmed; the video-capture perf follow-up is a small tracked item, not a blocker). Session 6 remains deferred until more devices are available.

---

## Session 8 — Shake-to-Release Vapor Aura Game

**Date:** 2026-07-05

Full design/rationale in `Planning/CONTEXT.md` (post-Session 7 pivot entry) and `Planning/WildstoneScentAura_Plan.md` (Session 8). Summary of what changed:

**Done:**
- `src/aura/AuraRenderer.js` — added a generic motion-energy signal: diffs `smoothedAnchor` against the previous frame's value (the only place cross-frame anchor state already existed), EMA-smoothed (`ENERGY_SMOOTHING = 0.25`) and clamped into 0-1 (`energy01`), plus a unit direction vector (`dirX`/`dirY`). Both are passed into `particleSystem.update(...)` at the existing call site. Guarded against a false spike on the very first frame after `start()` (skipped while `dt === 0`, and `prevAnchor`/`motionEnergy` reset in `start()`).
- `src/aura/particleSystem.js` — `update()` signature extended to `(dt, anchor, width, height, motionEnergy01, motionDirX, motionDirY)`; emission now requires `motionEnergy01 > MOTION_GATE_THRESHOLD` (0.05) in addition to the existing `confidence > 0.05` gate, so particles only emit during active motion for **both** the camera and Touch Canvas paths — no per-path special-casing needed since both already funnel through this one function. Variant contract otherwise unchanged (`createParticle`'s 3 new args are optional/backward-compatible).
- `src/aura/shakeTracker.js` (new) — zig-zag-style reversal detector on the anchor's x-position: tracks a running extreme from a reference point, confirms a "reversal" once the signal retraces `AMPLITUDE_THRESHOLD` (0.06), ends a round on stillness (`STILLNESS_MS = 600`) or a safety cap (`MAX_ROUND_MS = 4000`), then scores it: `ampNorm` (mean reversal amplitude vs. a target range), `consistency` (inverted coefficient-of-variation of inter-reversal intervals — this is what encodes "too fast = erratic," not literal speed), `tempoRateNorm` (reversals/sec vs. a `[1.5, 4]` band). Composite `score = 100 * (0.45*ampNorm + 0.35*consistency + 0.20*tempoRateNorm)`, bucketed too-slow (amplitude checked first) / too-fast (inconsistent) / perfect.
- `src/aura/VaporVariant.js` (new, replaces `src/aura/EdgeVariant.js` — **deleted**) — soft radial-gradient mist dots instead of jagged lightning-arc polylines. Idle motion is a gentle upward drift + jitter; blends toward streaming in the shake's direction as `motionEnergy01` rises, so a confident shake reads as visibly denser/more coherent than a weak one. Lower `drag` (0.6-1.1) and longer `maxLife` (0.9-1.6s) than Edge so mist lingers/drifts instead of snapping. Reuses `AuraRenderer.js`'s existing additive `globalCompositeOperation = 'lighter'` blending unchanged.
- `src/state/appStateMachine.js` — added `SHAKE_RESULTS` state, `LIVE_AURA + SHAKE_COMPLETE -> SHAKE_RESULTS`, `SHAKE_RESULTS + RETRY -> LIVE_AURA`. No origin-tracking sentinel needed (reachable from exactly one place, same reasoning that led this codebase to revert its earlier `RETURN_TO_ORIGIN` mechanism once it became single-branch).
- `src/screens/ShakeResultsScreen.js` (new) — score + bucket copy + a single Retry button, following `CapturePreviewScreen.js`'s minimal template-string pattern. **No direct capture path from results** — confirmed with the user: capture still happens via the existing button back in `LIVE_AURA`, so `CAPTURE_PREVIEW`/`SHARE`/the whole capture pipeline are untouched.
- `src/screens/LiveAuraScreen.js` — swapped `EdgeVariant` → `VaporVariant`; instantiates `shakeTracker`, feeding it the same anchor computed for `renderer.setAnchor` inside `drawDetections`, with its own wall-clock `dt` (detections arrive at ~15Hz, not per-rAF, mirroring `AuraRenderer.js`'s own `lastTime`/`dt` pattern). `onShakeComplete` added to the screen's options; `shakeTracker.reset()` added to `unmount()`.
- `src/screens/TouchCanvasFallbackScreen.js` — one-line variant swap only (`EdgeVariant` → `VaporVariant`); no other changes needed since it already only feeds anchors while a pointer is actively down, so the new motion gate applies for free.
- `src/main.js` — new `SHAKE_RESULTS` case in `render()`, `lastShakeResult` module-level state, `onShakeComplete` callback wired into the `LIVE_AURA` case following the exact same shape as `handleCapture`/`onCapture`.
- Explicitly unchanged, per the user's decision: `src/capture/*`, `src/share/shareSheet.js`, `CapturePreviewScreen.js`, `ShareScreen.js` — no slow-mo, no score-burned video, no re-encoding.
- Added `tests/e2e/stateMachine.spec.js` cases for the new transitions (`LIVE_AURA + SHAKE_COMPLETE -> SHAKE_RESULTS` + retry, and confirming `SHAKE_RESULTS` has no other outgoing transitions).

**Verified so far (desktop/headless, not yet real-device):**
- `npm run build` succeeds; `npm run test:unit` (11/11, including the 2 new FSM cases) and `npx playwright test` (2/2, existing fallback/share specs unmodified — confirms capture/share wasn't disturbed) all green.
- Ad-hoc Playwright pixel-read smoke check (written, verified, then discarded — not part of the committed suite, matching this project's established pattern from Session 4): on the Touch Canvas fallback, held a pointer down without moving for 700ms and read the aura canvas's pixel buffer — confirmed **zero** non-transparent pixels (no particles while genuinely still, the core "particles only released on shake" property). Then moved the pointer back and forth several times and re-read the buffer — confirmed non-transparent pixels appear once there's real motion. This is the first real evidence the motion-energy gate actually works end-to-end in a browser engine, not just at the unit level.

**Not yet real-device confirmed** (same gap pattern as every prior visual/tuning session):
1. Whether a real head-shake in front of the camera actually produces a well-scored round — the `shakeTracker.js` constants (`AMPLITUDE_THRESHOLD`, `STILLNESS_MS`, `MAX_ROUND_MS`, `TEMPO_MIN`/`MAX`, `AMP_MIN`/`AMP_TARGET`) are explicit starting estimates, not measured against a real face-tracked shake.
2. Whether the vapor look (density, drift, coherence-with-energy) actually reads as intended against a real face, not a synthetic mouse drag.
3. `AuraRenderer.js`'s `ENERGY_SMOOTHING`/`ENERGY_MAX`/`MOTION_GATE_THRESHOLD` — tuned by feel, not measured against real detection-rate anchor updates (~15Hz on a real device vs. this session's desktop/headless testing).

**Next:** real-device retest (Android) per the plan's Session 8 done-criteria — confirm no idle particles standing still, a real shake produces a scored round landing on the results screen, Retry cleanly starts a fresh round, and tune the constants above by feel.

**Real-device retest: no particles on head-shake at all.** First real-phone check showed zero particle release regardless of shake — a real bug, not just an undertuned threshold.

**Root cause found:** the motion-energy signal was computed by diffing `smoothedAnchor` — the already-lerped render-space anchor — once per render frame. That lerp exists purely to make rendering look smooth at 60fps across sparse ~15Hz detection updates; diffing it for motion *measurement* meant a real head movement only showed up as a small fraction of its true speed, since a single detection update only nudges `smoothedAnchor` 22% of the way there per frame, spread across several frames. At real detection rates this diluted the signal below `MOTION_GATE_THRESHOLD` almost always. The original desktop Playwright smoke check (Session 8, above) missed this because a fast/large synthetic mouse drag was still big enough to clear the bar despite the same dilution — it wasn't a representative stand-in for real head-shake magnitude.

**Fix:** `AuraRenderer.js`'s motion-energy computation moved out of the render loop and into `setAnchor()` itself — it now measures the true velocity between consecutive raw anchor arrivals (real wall-clock gap, real position delta), completely decoupled from the rendering lerp. `frame()` now only applies a per-frame exponential decay (`ENERGY_DECAY_PER_SEC = 4`) so energy still falls back to ~0 shortly after motion stops. Recalibrated `ENERGY_MAX` (6 → 3) and `particleSystem.js`'s `MOTION_GATE_THRESHOLD` (0.05 → 0.02) for the new, undiluted signal scale — biased toward "gentle motion still shows *some* particles" over risking the same silent-failure mode.

**Verified:** `npm run build`, `npm run test:unit` (11/11), `npx playwright test` (2/2) all still green. Two new ad-hoc smoke checks (written, verified, discarded): a *gentle*, small-amplitude, moderate-pace drag (~8% of viewport width, closer to a real head-shake's normalized-x swing than the original fast/large drag) now produces particles; held-still still produces none. **Not yet re-confirmed on the real device** — this is a targeted fix for the reported symptom, but the underlying scoring/motion constants are still starting estimates and may need further on-device tuning.

---

## Session 9 — Scored Aura Release Flow (particle look + capture-flow pivot, client feedback)

**Date:** 2026-07-06

Full design in `Planning/WildstoneScentAura_Plan.md` (Session 9) and `Planning/CONTEXT.md`. Summary of what changed:

**Done:**
- `src/aura/particleSystem.js` — particles no longer die on `age >= maxLife`. Each particle now has a `settleTime` (the old burst/drift duration); once past it, the particle hands off to an idle-float phase (gentle sinusoidal bob around its settle point + slow continued upward drift) instead of being culled, so it keeps floating for the rest of the capture. `maxParticles` raised 220 → 400 with oldest-first eviction (`particles.shift()`) as the pool-cap safety net now that particle death no longer frees slots on its own.
- `src/aura/VaporVariant.js` — palette replaced (pale near-white/cyan → saturated multi-hue: pink, purple, cyan, teal, gold, white) with a smaller, brighter core + tighter glow falloff (bright core circle drawn on top of the gradient) instead of one large soft radial gradient, per the client's reference image of colorful sparkles rather than translucent bubbles. Spawn point widened from a tight ring on the face to a downward-offset ellipse sized off `anchor.scale` (approximating "around the person," not silhouette-aware — there's still no body/pose tracking). Added the new `settleTime`/`floatSpeed`/`floatPhase`/`floatRadiusX`/`floatRadiusY`/`driftY`/`settled` fields `particleSystem.js` now drives.
- `src/aura/AuraRenderer.js` — added an `armed` flag (default `true`, so Touch Canvas fallback is unaffected without any code change there) + `setArmed()`. While unarmed, `energy01` is forced to 0 before reaching `particleSystem.update`, so existing particles still age/float normally but no new ones emit — this is the idle-vs-recording gate.
- `src/aura/shakeTracker.js` — `MAX_ROUND_MS` raised 4000 → 9500 to fit a round inside the new 10s clip; `STILLNESS_MS` (600ms) unchanged, still the "round complete" signal. Added a `locked` flag: once a round completes, `update()` becomes a no-op until `reset()`, so a later re-shake within the same clip can't overwrite the first score (confirmed default with the user).
- `src/capture/videoCapture.js` — `MAX_DURATION_MS` 5000 → 10000. Added a `getScoreResult` callback param, polled once per composited frame (score isn't known at recording-start, only once shakeTracker locks it) and threaded into `compositeFrame`.
- `src/ui/ScoreOverlay.js` (new) — burns the score number + bucket copy (moved from the now-deleted `ShakeResultsScreen.js`) into a translucent top band; no-ops while `result` is null, so the first part of the clip is clean and the score appears and holds once the round locks.
- `src/capture/compositeFrame.js` — accepts `scoreResult`, calls `drawScoreOverlay` between the aura layer and the existing `BrandOverlay.js` watermark.
- `src/capture/snapshotCapture.js` — deleted (dead code once the manual tap/hold button was removed — nothing else referenced it). `src/utils/coverCrop.js`'s stale comment pointing to it updated to reference `compositeFrame.js` instead.
- `src/screens/LiveAuraScreen.js` — rewritten: replaced the old always-on tap=snapshot/long-press=video capture button with a single "Release your aura" button. `armed` starts `false` (idle: camera + face tracking live, `renderer.setArmed(false)`, `shakeTracker.update` not called). Tapping the button (`releaseAura()`) sets `armed = true`, resets `shakeTracker`/`lockedResult`, arms the renderer, and auto-starts a 10s `startVideoCapture` with `getScoreResult: () => lockedResult`; on the recording's `done`, calls `onCapture(blob)` and resets back to idle. Guarded by a `videoCaptureReady` check (`ENABLE_VIDEO_CAPTURE && isVideoCaptureSupported()`) since video is now the sole capture path with no snapshot fallback — the button visibly disables ("Capture unavailable") rather than throwing if unsupported.
- `src/screens/ShakeResultsScreen.js` — deleted. `src/state/appStateMachine.js` — removed the `SHAKE_RESULTS` state and `LIVE_AURA`'s `SHAKE_COMPLETE` event entirely; `LIVE_AURA`'s only outgoing events are now `CAPTURE` and `CAMERA_LOST`. `src/main.js` — removed `mountShakeResultsScreen` import, `lastShakeResult`, and `onShakeComplete` wiring; `LIVE_AURA` case now only passes `videoEl`/`onCapture`.
- `styles/main.css` — removed `.screen-shake-results`/`.shake-results-*` and the old `.capture-btn` rule set; added `.release-btn` (pill button matching `.btn-primary`'s gradient, fixed bottom position like the old capture button) with `.recording` (pulsing red, active while the 10s capture runs) and `:disabled` (muted, unsupported-browser) states.
- `tests/e2e/stateMachine.spec.js` — removed the two `SHAKE_RESULTS`/`SHAKE_COMPLETE` cases (state no longer exists).

**Verified so far (desktop/headless, not yet real-device):**
- `npm run test:unit` (9/9, two obsolete cases removed), `npx playwright test` (2/2, unmodified fallback/share specs still pass — confirms the Touch Canvas branch wasn't disturbed), `npm run build` all green.
- Manual code-path review (not yet exercised in a real browser): idle → tap "Release your aura" → armed/recording → 10s auto-stop → `CAPTURE_PREVIEW` with a video that should have the score+watermark burned in.

**Not yet real-device confirmed** (same gap pattern as every prior visual/tuning session):
1. Whether the new sparkle palette/spawn-ellipse/idle-float actually reads as "colorful particles floating around the person" against a real face, not just correct in code.
2. Whether `maxParticles = 400` is enough headroom for a full 10s clip of vigorous shaking without visibly hitting the oldest-first eviction cap, or whether it needs raising further.
3. Whether the score overlay's timing/placement (appears mid-clip once the round locks, top band) reads well composited over real video, not just over a solid background in review.
4. Whether `MAX_ROUND_MS = 9500` and the idle/armed transition feel right against a real head-shake's timing — these are starting estimates, same as every other tuning constant in this project.

**Next:** real-device retest (Android) per the plan's Session 9 done-criteria — confirm no particles/recording before tapping the button, colorful person-scaled floating particles, a score+watermark burned into the saved video, and Retry landing back on idle.

---

## Session 10 — Aura Feel Fixes (head-attraction, water-flick burst, live score, client feedback)

**Date:** 2026-07-06

Full design, root-cause analysis, and exact constants in `Planning/Session10_AuraFeelFixes_Plan.md`. Real-device retest of Session 9 surfaced three feel problems, all fixed this session:

**Done:**
- `src/aura/particleSystem.js` — added `ANCHOR_TRUST_THRESHOLD` (0.05, promoted from the existing inline literal, now shared by the emission gate and the new follow logic) and `FOLLOW_GAIN` (0.25). Once per frame, if the anchor is trustworthy this frame and was trustworthy last frame too, computes `followDx/Dy` from the anchor's own pixel movement since last frame; if trust is lost (or regained, or Touch Canvas releases to its neutral center anchor), the last-seen anchor position is cleared instead of left stale, zeroing the nudge for that gap. In the settled/idle branch only, `p.settleX/settleY` get nudged by `followDx/Dy` every frame after the initial freeze — burst-phase particles are untouched by this. Burst-phase particles also gained one line, `p.vy += (p.gravity || 0) * dt`, applied before the existing drag/position integration, so a variant-supplied `p.gravity` now produces a real arc.
- `src/aura/VaporVariant.js` — spawn ellipse tightened from a wide person-sized region (`faceSize*2.5` offset, `radiusX ∈ [2.5,4]×faceSize`, `radiusY ∈ [3,6]×faceSize`) down to a tight region hugging the head (`faceSize*0.3` offset, `radiusX ∈ [0.6,1.1]×faceSize`, `radiusY ∈ [0.5,0.9]×faceSize`). The old idle/stream velocity lerp is gone, replaced by a spray-cone "flick": base angle from the current shake direction (`atan2(dirY, dirX)`), falling back to a mostly-upward cone (`-90°`) when there's no clear direction yet, fanned by `± SPRAY_HALF_ANGLE_RAD` (~45°). Speed is `rand(SPRAY_SPEED_MIN, SPRAY_SPEED_MAX)` (140–320 px/s at scale 1) times an energy multiplier with its own floor (`0.7 + 0.3×energy01`) so a barely-there shake still flicks with real force. Each particle now carries `p.gravity = GRAVITY_PX_S2 * scale` (260 px/s²) for `particleSystem.js`'s new gravity line.
- `src/aura/shakeTracker.js` — dropped the `onRoundComplete` push callback; `createShakeTracker()` is now zero-argument. Added pull-based `getScore()`: returns the frozen `{ ...lockedResult, locked: true }` once locked, a freshly-recomputed `{ ...scoreRound(...), locked: false }` while a round is active, or `null` before any round has started. `completeRound()` now stores into an internal `lockedResult` instead of firing a callback.
- `src/screens/LiveAuraScreen.js` — simplified to match: `createShakeTracker()` with no options, deleted the `lockedResult` closure variable, `getScoreResult: () => shakeTracker.getScore()` instead of reading a locked-only closure variable.
- `src/ui/ScoreOverlay.js` — the score number now renders and updates on every call where `result` is non-null (i.e. from the moment the round starts, not just once locked); the verdict/bucket line is now gated on `result.locked === true` so it doesn't flash a premature verdict mid-shake.

**Verified (desktop/headless, not yet real-device):**
- `npm run test:unit` (9/9, unchanged), `npm run build`, `npx playwright test` (2/2, unmodified fallback/share specs) all green.

**Not yet real-device confirmed** (same gap pattern as every prior visual-tuning session) — this is the primary open item:
1. Whether floating particles visibly drift with head movement now (`FOLLOW_GAIN = 0.25`) without either feeling static (too low) or overshooting/lagging oddly (too high).
2. Whether the tightened spawn ellipse + spray-cone + gravity actually reads as "water flicking off after a shake" rather than the old "bubbles popping in" look — `GRAVITY_PX_S2`, `SPRAY_SPEED_MIN/MAX`, and `SPRAY_HALF_ANGLE_RAD` are all explicit starting estimates.
3. Whether the live-updating score number is legible/well-timed against real composited video, and that the verdict text appearing only at lock doesn't feel like a jarring pop-in.
4. Touch Canvas fallback recheck — confirm no particles snap toward the neutral center anchor on pointer release, and the burst still reads fine at `scale: 1`.

**Next:** real-device retest per `Planning/Session10_AuraFeelFixes_Plan.md`'s Verification section, then proceed to Session 11 (bundle budget + load-perf pass) once the feel is confirmed.
