# Wildstone Scent Aura — Implementation Plan

## Context

TinyApps is a container for small, self-contained web apps. The first app, **Wildstone Scent Aura**, is a mobile-first web AR marketing experience for a client demo — the aura visually reacts to the user's face movement and lets them capture/share a branded image or clip. Full original vision lives in `docs/Wildstone_Scent_Aura_PRD.md`; scope decisions (lightweight face-detection over full mesh, Edge-variant-only scope, spike-first capture strategy, Touch Canvas fallback as demo insurance, no backend/analytics, build tooling, deploy pipeline, testing strategy, naming conventions) are recorded in `Planning/CONTEXT.md` → Architecture Decisions.

Constraints for this build: **1-month timeline**, built progressively by Claude Code across multiple discrete sessions; **Vercel hosting** via a GitHub repo + git integration; **real iOS and Android devices available** for hands-on testing (critical, since the two biggest risks — iOS Safari video-capture reliability and real-device face-tracking performance — cannot be validated any other way).

Because the work spans many sessions over a month, this plan is structured as **discrete, resumable sessions with explicit "done" criteria**, and a session log (`src/WildstoneScentAura/PROGRESS.md`) is updated at the end of every session so a future session (with no memory of this one) can pick up exactly where it left off.

**Intended outcome:** a deployed Vercel URL that runs the full Wildstone Edge aura experience (splash → camera permission → live face-tracked aura → capture → share, with a Touch Canvas fallback if camera fails) reliably enough to survive an unrehearsed live demo on the client's own phone.

## Architecture Decisions

Full rationale for each of these lives in `Planning/CONTEXT.md` → Architecture Decisions; summarized here for quick reference:

- **Build tooling:** Vite, vanilla-JS template. No TypeScript, no framework, no Three.js.
- **Tracking:** `@mediapipe/tasks-vision`'s `FaceDetector` (bounding box/landmarks), not `FaceLandmarker` (full mesh). WASM + model files self-hosted under `public/mediapipe/`, not CDN-loaded.
- **Aura renderer:** Canvas2D as the committed path; `AuraRenderer.js` built as a swappable seam so a WebGL backend can be attempted later only if perf headroom allows.
- **Shared anchor interface:** both the camera face-tracker and the Touch Canvas fallback emit the same `{ x, y, scale, confidence }` shape, so one aura system serves both input paths.
- **Capture:** `snapshotCapture.js` (canvas.toDataURL) is the guaranteed, always-shipped path. `videoCapture.js` (MediaRecorder + captureStream) is feature-flagged via `captureFeatureFlags.js`, gated entirely on the Session 1 iOS spike result.
- **Detection vs. render rate:** `FaceDetector.detectForVideo()` throttled (~15-20Hz); interpolated/smoothed to full 60fps render via `landmarkSmoothing.js`. Web Worker split (`faceTrackerWorker.js`) only if Session 2's perf spike shows main-thread contention.
- **Naming conventions:** PascalCase for component-like/screen files (`SplashScreen.js`, `AuraRenderer.js`), camelCase for logic/utility files (`faceTracker.js`, `cameraStream.js`), lowercase plain folders for categories (`screens/`, `camera/`, `aura/`).
- **Aura interaction model (post-Session 7 pivot):** particles emit only during an active head-shake motion (a generic motion-energy signal computed in `AuraRenderer.js`), not continuously on face-detection confidence alone — reframes the aura from passive ambient tracking into a scored mini-game. `shakeTracker.js` scores each shake round on amplitude + tempo-consistency (not raw speed), bucketed too-slow/too-fast/perfect, landing on a retry-only results screen (`ShakeResultsScreen.js`). `VaporVariant.js` (soft floating mist dots) replaces `EdgeVariant.js`'s jagged lightning-arc look entirely — not a coexisting alternate. Capture/share is explicitly unchanged: no slow-mo or score-burned video; capture still happens via the existing button back in `LIVE_AURA`. Full design in `Planning/CONTEXT.md` → Architecture Decisions.
- **Testing:** small (4-6 test) Playwright + `node:test` suite for deterministic logic and browser-mockable flows only. Real face-tracking accuracy/perf and real iOS Safari MediaRecorder reliability are explicitly NOT automated — Playwright's `webkit` project is desktop WebKit and won't reproduce real mobile Safari bugs.
- **Deploy:** git repo in TinyApps → GitHub → Vercel git integration, Root Directory `src/WildstoneScentAura`, framework preset Vite (auto-detected). `vercel.json` adds a `Permissions-Policy: camera=(self)` header and long-lived immutable caching on hashed asset/mediapipe paths.

## File Structure

```
TinyApps/
├── src/WildstoneScentAura/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── vercel.json
│   ├── PROGRESS.md                          # session log — see "Session Continuity" below
│   ├── public/mediapipe/                    # self-hosted WASM + model, copied once in Session 0
│   ├── styles/main.css
│   ├── src/
│   │   ├── main.js
│   │   ├── state/appStateMachine.js         # pure FSM — see state graph below
│   │   ├── screens/                         # SplashScreen.js, PermissionScreen.js, LiveAuraScreen.js,
│   │   │                                    # CapturePreviewScreen.js, ShareScreen.js, TouchCanvasFallbackScreen.js,
│   │   │                                    # ShakeResultsScreen.js
│   │   ├── camera/                          # cameraStream.js, cameraErrors.js
│   │   ├── tracking/                        # faceTracker.js, landmarkSmoothing.js, (faceTrackerWorker.js if needed)
│   │   ├── aura/                            # AuraRenderer.js, VaporVariant.js, particleSystem.js, shakeTracker.js
│   │   ├── capture/                         # snapshotCapture.js, videoCapture.js, captureFeatureFlags.js
│   │   ├── touchCanvas/touchAuraController.js
│   │   ├── share/shareSheet.js
│   │   ├── ui/                              # BrandOverlay.js, domRefs.js
│   │   └── utils/                           # deviceCapabilities.js, perfMonitor.js
│   └── tests/e2e/                           # stateMachine.spec.js, fallback.spec.js, shareSheet.spec.js
```

State graph (`appStateMachine.js`):
```
SPLASH --tap Start--> PERMISSION_REQUEST
PERMISSION_REQUEST --getUserMedia resolves--> CAMERA_INITIALIZING
PERMISSION_REQUEST --NotAllowedError/dismiss--> FALLBACK_TOUCH_CANVAS
CAMERA_INITIALIZING --first frame + model ready--> LIVE_AURA
CAMERA_INITIALIZING --timeout/NotReadableError--> FALLBACK_TOUCH_CANVAS
LIVE_AURA --track.onended (camera dies mid-session)--> FALLBACK_TOUCH_CANVAS
LIVE_AURA --tap capture--> CAPTURE_PREVIEW
LIVE_AURA --shake round complete--> SHAKE_RESULTS     # added Session 8 (shake game)
SHAKE_RESULTS --retry--> LIVE_AURA                    # added Session 8 (shake game)
CAPTURE_PREVIEW --retry--> LIVE_AURA
CAPTURE_PREVIEW --confirm--> SHARE
SHARE --done--> LIVE_AURA
FALLBACK_TOUCH_CANVAS --capture--> CAPTURE_PREVIEW   # reuses capture/preview/share flow, snapshot-only
```

Note: the original scope note above ("Touch Canvas reuses capture/preview/share flow") was corrected during Session 5 — capture is only reachable from `LIVE_AURA` in the actual implementation; see `Planning/CONTEXT.md`'s Session 5 correction entry.

## Session Continuity (how future sessions pick this up)

At the **end of every working session**, update `src/WildstoneScentAura/PROGRESS.md` with:
- Session number/date, what was completed (with file paths touched)
- Any go/no-go decisions made (e.g. video-capture spike result) and why
- What's next, and any open blockers

Also update `Planning/CONTEXT.md` → Architecture Decisions for any decision that changes previously-recorded scope. A new session should be able to read `PROGRESS.md` + `Planning/CONTEXT.md` and resume without re-deriving context.

## Session-by-Session Plan (~12 sessions over 1 month)

**Session 0 — Repo, deploy pipeline, and camera "hello world"**
- Init git in `TinyApps/`, create GitHub repo, connect to Vercel (Root Directory `src/WildstoneScentAura`).
- Scaffold Vite vanilla template; install `@mediapipe/tasks-vision`; copy its WASM assets + download `blaze_face_short_range.tflite` into `public/mediapipe/`.
- Minimal page: live webcam feed + console-logged face bounding box.
- Deploy to Vercel; test on a real phone over HTTPS (validates secure-context + permission prompt).
- Create `PROGRESS.md`.
- **Done when:** deployed preview URL shows live camera feed + logged bounding box on a real phone.

**Session 1 — iOS video-capture spike** (highest risk item, done first)
- Throwaway harness: video+canvas composite → `captureStream()` → `MediaRecorder` → download link.
- Test on a real iPhone. Record pass/fail and failure mode.
- **Done when:** `captureFeatureFlags.js`'s `ENABLE_VIDEO_CAPTURE` is set true/false based on real evidence; result logged in `PROGRESS.md` and `Planning/CONTEXT.md`.

**Session 2 — Real-device face-detection perf spike**
- Wire `FaceDetector` to the live stream; measure latency/FPS via `perfMonitor.js` on a real mid/low-range Android and the iPhone.
- Lock in input resolution + detection throttle rate.
- **Done when:** FPS recorded on both real devices; go/no-go on hitting target without a Worker.

**Session 3 — State machine + screen shell**
- Build `appStateMachine.js` (+ `stateMachine.spec.js`); wire Splash → Permission → LiveAura shell with debug bounding-box overlay; wire deny-permission → Touch Canvas branch.
- **Done when:** full state graph is manually navigable including the forced-deny path, on desktop + a real phone; `fallback.spec.js` passes.

**Session 4 — Canvas2D aura v1 (Wildstone Edge)**
- Build `particleSystem.js` + `EdgeVariant.js` + Canvas2D `AuraRenderer.js`, driven by `faceTracker.js`; hook `touchAuraController.js` to the same renderer via the shared anchor interface.
- **Done when:** aura visibly follows face movement on a real phone at acceptable frame rate; Touch Canvas mode renders the same aura via finger drag.

**Session 5 — Capture + share**
- `snapshotCapture.js` + `BrandOverlay.js` watermark + `shareSheet.js`. If Session 1 passed, additively wire `videoCapture.js` (long-press = video, tap = snapshot); otherwise snapshot-only.
- **Done when:** full journey (both camera branch and touch-canvas branch) completes end-to-end on a real phone through to share.

**Session 6 — Broad real-device compatibility pass #1**
- Test 2+ iOS Safari devices/versions, 2+ Android Chrome tiers. Fix orientation, aspect-ratio letterboxing, devicePixelRatio scaling, `playsinline`/autoplay quirks.
- **Done when:** journey completes without hard failure on every device tested; non-blocking issues logged in `PROGRESS.md`.

**Session 7 — Visual polish + WebGL stretch decision**
- Based on Sessions 1-2 perf data, decide whether to invest in more Canvas2D layering or attempt a WebGL backend behind the `AuraRenderer` seam. Apply `emil-design-eng`/`impeccable`/`interface-design`/`ui-skills` per this workspace's mandatory UI guardrails.
- **Done when:** Edge variant is visually demo-ready; no unresolved P0 visual bugs.

**Session 8 — Shake-to-Release Vapor Aura Game**
- Add a generic motion-energy signal to `AuraRenderer.js` (diff `smoothedAnchor` frame-to-frame; the only place cross-frame anchor state already lives) and thread it into `particleSystem.js`'s emission formula so particles only emit while there's active motion, for both the camera and Touch Canvas paths.
- Build `shakeTracker.js`: detects a shake round via direction-reversal counting on the anchor's x-position, scores it on amplitude + tempo-consistency (not raw speed) into too-slow/too-fast/perfect, fires once per round.
- Build `VaporVariant.js` (soft radial-gradient mist dots, motion-coupled drift/coherence) replacing `EdgeVariant.js` entirely — delete the old jagged-arc variant.
- Add `SHAKE_RESULTS` state + `SHAKE_COMPLETE`/`RETRY` events to `appStateMachine.js`; build `ShakeResultsScreen.js` (score + retry button only — no direct capture path from results, capture stays on the existing button in `LIVE_AURA`); wire into `main.js` following the existing `handleCapture`/`onCapture` pattern.
- Explicitly unchanged: `src/capture/*`, `src/share/shareSheet.js`, `CapturePreviewScreen.js`, `ShareScreen.js` — no slow-mo, no score-burned video, no re-encoding.
- **Done when:** standing still in front of the camera produces no particles; a real head-shake produces a scored round landing on the results screen; Retry cleanly starts a fresh round; Touch Canvas fallback still only emits while actively dragging (no code change needed there, confirmed by the motion gate alone). Tuning constants (amplitude/tempo thresholds, vapor emission rate/drag/life) are starting estimates, finalized only after real-device eyes, same as every other tuning constant in this plan (e.g. `RING_RADIUS_FRACTION`).

**Session 9 — Bundle budget + load-perf pass**
- Measure real production build weight; confirm the MediaPipe chunk is deferred past initial paint; add a loading indicator covering the wasm/model fetch during `CAMERA_INITIALIZING`.
- **Done when:** initial shell measured under 3MB; time-to-live-aura on a throttled mobile profile recorded and judged acceptable.

**Session 10 — Edge-case hardening**
- Permission revoked mid-session, tab backgrounded/foregrounded, orientation change during live aura, no-face-detected idle state, multiple faces (pick highest-confidence box). Full Playwright suite green.
- **Done when:** no crashes across these cases on a real device; automated suite passes.

**Session 11 — Full demo rehearsal**
- Hand the deployed URL to someone else's phone, cold and unrehearsed — the closest realistic proxy for the client's own unknown device. Run the full script once as the actual demo would go.
- Update `Planning/CONTEXT.md` and `ops/CONTEXT.md` with final go/no-go state.
- **Done when:** one complete unaided run-through succeeds on a device never tested before, splash through share.

## Verification (how to confirm this is working, throughout)

- **Every session:** deploy to a Vercel preview URL and open it on a real phone (not desktop devtools emulation) — this is the only reliable way to validate camera/tracking/capture behavior.
- **After Session 0:** confirm the deployed URL shows a live camera feed and logs a face bounding box in the console on a real phone.
- **After Session 1:** confirm the recorded video-capture spike result (pass or fail) is reflected in `captureFeatureFlags.js` and matches what was actually observed on the iPhone.
- **After Session 3 onward:** run `npx playwright test` (or `node --test` for the pure FSM spec) and confirm all tests pass before moving to the next session.
- **After Session 5:** manually walk the full journey twice on a real phone — once via the camera path, once by forcing the fallback (deny permission) — through to a successful share/download.
- **After Session 8:** manual desktop check with `?debug=1` confirms Touch Canvas vapor dots only appear while actively dragging; real-device retest confirms no idle particles, a scored shake round, and a clean retry loop before tuning constants are finalized.
- **Session 11 (final):** the unaided cold run-through on an untested device is the actual acceptance test for the whole month of work — this is the condition that determines "ready for the client demo."
