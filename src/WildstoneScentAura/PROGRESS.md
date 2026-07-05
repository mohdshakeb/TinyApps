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

**Not yet done / blocked:**
- **Vercel connection is pending on you** — you're connecting `mohdshakeb/TinyApps` via the Vercel dashboard (Root Directory: `src/WildstoneScentAura`, framework preset should auto-detect as Vite). Once connected, get the preview URL and open it on a real phone to confirm: camera permission prompt appears, live feed renders, and the console logs face bounding boxes.
- Real-device validation (the actual "done" criterion for Session 0) hasn't happened yet — needs the Vercel URL above.
- `FaceDetector` is currently configured with `delegate: 'GPU'` (untested) — if this errors on a real device/browser, may need a CPU-delegate fallback. Not yet a problem since Session 2 is where real-device perf gets measured properly; flagging so it isn't a surprise.

**Next session (Session 1 — iOS video-capture spike):**
- Build the throwaway capture harness (video+canvas composite → `captureStream()` → `MediaRecorder` → download link) and test on a real iPhone.
- Before starting, confirm Session 0's real-device test passed (camera + tracking working on the Vercel URL) — if it didn't, fix that first since everything else builds on it.
