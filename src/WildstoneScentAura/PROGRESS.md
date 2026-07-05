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

**Not yet done:**
- Real-device retest on both Chrome and Brave (Android) now that error surfacing is fixed — need to see the actual Chrome worker-init error message, and confirm whether Brave's denial is a Shields/permission-state issue (may need resetting site permissions in Brave settings) or something else.
- Once tracker init succeeds again: confirm `mainThreadFps` stays near 60 with the Worker offload (still not yet confirmed on real device).
- iPhone half of this session (perf on real iOS hardware) — deferred until an iPhone is available.
