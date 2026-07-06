# Session 10: Aura feel fixes — head-attraction, water-flick burst, live score

Referenced from `Planning/WildstoneScentAura_Plan.md` (Session 10) and `Planning/CONTEXT.md` → Architecture Decisions. This doc holds the full design detail; the master plan keeps only a summary.

## Context

Session 9 shipped the "shake to release" flow: colorful particles burst on a head-shake, settle into a floating idle state, and a score gets burned into the captured video. After testing on a real device, the client gave three pieces of feedback:

1. **Particles don't feel attached to the person.** Once released, particles float in a fixed screen position and never react to the head moving afterward — they should feel loosely leashed to the person, drifting along as they move.
2. **Release still looks like bubbles popping in randomly, not water flicking off after a head shake.** Two causes: the spawn area is far too large (particles can appear almost anywhere in the top half of the screen), and there's no gravity or directional "flick" to the burst — particles just softly decelerate and hover instead of arcing outward and down like flung water droplets.
3. **The score only appears for the last fraction of a second of the 10s video**, because it's only computed once the shake round completes, and completion is usually triggered by the 9.5s safety cap (users rarely pause long enough to trigger the earlier stillness-based completion).

A fix for #3 (live-updating score) was picked over post-processing the video after the fact — post-processing would require either a risky WebCodecs dependency on iOS (a platform this project still can't test on a real device) or roughly doubling the wait time via a second real-time re-encode pass. Live-updating stays inside today's architecture with no such cost.

Root causes for all three were confirmed by reading the current code directly (`particleSystem.js`, `VaporVariant.js`, `AuraRenderer.js`, `shakeTracker.js`, `LiveAuraScreen.js`, `ScoreOverlay.js`, `videoCapture.js`, `touchAuraController.js`, `TouchCanvasFallbackScreen.js`). None of this has automated test coverage (`tests/e2e/*.spec.js` is FSM/screen-transition-only), so there's freedom to change internals without breaking anything beyond a manual real-device retest.

## 1. Particles should feel loosely attracted to the person

**Root cause:** `particleSystem.js`'s per-particle physics loop never reads `anchor` after a particle spawns — once `p.settled`, it freezes `p.settleX/settleY` forever and only bobs (sin/cos) around that frozen point.

**Fix — delta-based "leash nudge" in `src/aura/particleSystem.js`:**
- Add closure state `lastAnchorNormX/Y = null` (reset in `reset()`).
- Promote the existing inline `0.05` confidence check to a named constant `ANCHOR_TRUST_THRESHOLD = 0.05`, shared by the existing emission gate and this new follow logic (same underlying meaning: "is this anchor reading trustworthy").
- Once per frame (not per particle), before the particle loop: if the anchor is trustworthy and we had a trustworthy anchor last frame too, compute how far it moved in pixels since last frame (`(anchor.x - lastAnchorNormX) * width`, same for y) and scale by a new `FOLLOW_GAIN = 0.25` constant → `followDx/Dy`. If the anchor isn't trustworthy (lost tracking, or Touch Canvas's release-to-neutral-center), reset `lastAnchorNormX/Y = null` and `followDx/Dy = 0` — this is what prevents floating particles from snapping toward Touch Canvas's `{0.5, 0.5}` neutral anchor on release, or toward a stale position after a tracking gap.
- In the particle loop's **settled/idle branch only** (never the burst branch, so this can't fight fix #2's ballistic physics): after freezing `settleX/settleY` the first time, add `p.settleX += followDx; p.settleY += followDy` every frame after that. The existing sin/cos bob math is unchanged — it now just orbits a slowly-drifting center instead of a frozen one.
- This is a *delta* nudge (not "lerp toward the anchor's absolute position"), which matters: particles are scattered around the head, not on it, so nudging by the anchor's own frame-to-frame movement keeps each particle's relative offset intact while the whole floating cluster drifts along with the person.

**Touch Canvas:** shares this code unmodified. While dragging, floating particles will gently drift toward the finger (consistent, arguably a nice touch-mode bonus). On release, the confidence-gate gap-clearing means particles just keep bobbing in place — they will not chase the neutral center-screen anchor.

## 2. Release should look like flicked water, not popping bubbles

**Root cause A — spawn area too large:** `VaporVariant.js`'s spawn ellipse (`ellipseY = originY + faceSize*2.5`, `radiusX = faceSize*rand(2.5,4)`, `radiusY = faceSize*rand(3,6)`) can reach ~0.7× the shorter screen dimension — easily most of the visible frame, which is why particles read as appearing "anywhere."

**Root cause B — no gravity, no real flick:** burst velocity is a soft lerp between a gentle upward drift and a directional stream, with no gravity term anywhere — particles decelerate under drag and hover, they never arc.

**Fix — `src/aura/VaporVariant.js` (spawn + burst velocity) and `src/aura/particleSystem.js` (gravity):**
- **Tighten spawn** (`createParticle`): shrink the ellipse to sit tight around the head — `ellipseY = originY + faceSize * 0.3` (was `*2.5`), `radiusX = faceSize * rand(0.6, 1.1)` (was `*rand(2.5,4)`), `radiusY = faceSize * rand(0.5, 0.9)` (was `*rand(3,6)`). Same uniform-disc sampling, just a much smaller region.
- **Replace the soft idle/stream velocity lerp with a spray-cone "flick":** remove the `idleVx/Vy`/`streamVx/Vy`/`coherence`-lerp entirely. Compute a base angle from the current shake direction (`Math.atan2(dirY, dirX)`), falling back to a mostly-upward cone (`-90° ± ~23°`) when there's no clear direction yet (very start of a shake). Add a random spread around that base angle (`± SPRAY_HALF_ANGLE_RAD ≈ 45°`) so particles fan out like real flung water rather than shooting in one line. Speed scales with shake energy with a strong floor so it never reads as a weak dribble (`SPRAY_SPEED_MIN = 140`, `SPRAY_SPEED_MAX = 320` px/s at scale 1, before the energy multiplier).
- **Add gravity to the burst phase** (`particleSystem.js`): since this module is explicitly variant-agnostic, gravity strength is supplied per-particle by the variant (same pattern as the existing `p.drag`) — `VaporVariant.js` sets `p.gravity = GRAVITY_PX_S2 * scale` (starting estimate `260`). `particleSystem.js`'s burst-phase branch gains one line before the existing drag/position integration: `p.vy += (p.gravity || 0) * dt`. Drag continuing to act on the now-gravity-affected velocity is what produces a natural arc-then-settle instead of a runaway fall.
- All five new constants (`FOLLOW_GAIN`, `ANCHOR_TRUST_THRESHOLD`, spawn-ellipse ranges, spray speed/angle, gravity) are starting estimates that interact with each other — flagged for on-device tuning by eye, consistent with this project's established pattern (e.g. `shakeTracker.js`'s own tuning constants).

**Touch Canvas:** no special-casing needed — it always emits `scale: 1` (within the real face-anchor range of 0.7–1.6), and the spray direction already follows `motionDirX/Y`, which `AuraRenderer.js` derives generically from any anchor's movement, not just faces. Spawn will now hug the current fingertip instead of a huge area below it.

## 3. Score should update live, not reveal only at the end

**Fix — `src/aura/shakeTracker.js` API change (no other consumers besides `LiveAuraScreen.js`, confirmed via grep, so this is unconstrained):**
- Drop the `onRoundComplete` callback entirely; `createShakeTracker()` becomes zero-argument.
- Add a pull-based `getScore()` to the returned object (matches the polling model `videoCapture.js` already uses for `getScoreResult`):
  - If locked: return the frozen final result (`{ ...lockedResult, locked: true }`).
  - Else if a round is active: recompute `scoreRound(reversalEvents, elapsed - roundStartTime)` fresh on every call (cheap, pure) and return it with `locked: false`.
  - Else (no round started yet — user hasn't begun shaking): return `null`.
- `completeRound()` now stores the result into `lockedResult` instead of firing a callback; the existing `locked` flag / "no rescoring after lock" behavior is unchanged.
- Score only appears once `roundActive` first flips true — i.e., the moment the user's motion crosses the reversal-amplitude threshold, not at t=0 while they're still standing still. This avoids showing a meaningless static "0" before any real shake motion.

**`LiveAuraScreen.js` simplification:**
- `createShakeTracker({ onRoundComplete: ... })` → `createShakeTracker()`.
- Delete the `lockedResult` closure variable and its reset.
- `getScoreResult: () => lockedResult` → `getScoreResult: () => shakeTracker.getScore()`.
- Everything else (`shakeTracker.reset()` on each release, `shakeTracker.update()` only while armed) stays as-is.

**`src/ui/ScoreOverlay.js`** (confirmed with the user — hide the verdict line until locked): gate the `BUCKET_COPY` line on `result.locked === true`; the score number keeps rendering (and updating) regardless of `locked`. `compositeFrame.js` and `videoCapture.js` need no changes — they already just read whatever `result` they're given each frame.

## Summary of new/changed constants (all "starting estimate — on-device tuning")

| File | Constant | Starting value | Purpose |
|---|---|---|---|
| `particleSystem.js` | `ANCHOR_TRUST_THRESHOLD` | `0.05` (promoted from existing inline literal, shared by emission gate + new follow gate) | confidence floor to trust an anchor |
| `particleSystem.js` | `FOLLOW_GAIN` | `0.25` | fraction of anchor's per-frame movement applied to settled particles |
| `VaporVariant.js` | ellipse vertical offset | `faceSize * 0.3` (was `*2.5`) | tighten spawn to head/jaw area |
| `VaporVariant.js` | `radiusX` range | `faceSize * rand(0.6, 1.1)` (was `*rand(2.5,4)`) | tighten spawn spread |
| `VaporVariant.js` | `radiusY` range | `faceSize * rand(0.5, 0.9)` (was `*rand(3,6)`) | tighten spawn spread |
| `VaporVariant.js` | `SPRAY_SPEED_MIN` / `MAX` | `140` / `320` px/s | burst "flick" speed floor/ceiling |
| `VaporVariant.js` | `SPRAY_HALF_ANGLE_RAD` | `~0.78` (45°) | cone width of the water-flick spray |
| `VaporVariant.js` | `GRAVITY_PX_S2` | `260` | downward arc during burst phase |

## Verification

- No automated tests cover this behavior (confirmed by grep), so verification is manual/on-device, matching this project's established pattern for every prior visual-tuning session:
  - Run `npm run test:unit` and `npm run build` to confirm nothing else broke (fast, no reason to skip).
  - On a real device (or desktop `?debug=1` for a quick sanity pass): confirm standing still produces no particles, a shake produces a tight burst near the head that arcs downward before settling, the settled cloud drifts along when the head moves afterward, and the score number appears and climbs as soon as the shake starts (not at the very end), with the verdict text only appearing once it locks.
  - Record actual on-device impressions for `FOLLOW_GAIN`, `GRAVITY_PX_S2`, `SPRAY_SPEED_MIN/MAX`, `SPRAY_HALF_ANGLE_RAD`, and the tightened spawn-ellipse ranges — these are explicitly starting estimates, expect at least one iteration.
  - Confirm Touch Canvas fallback (deny camera permission, or force via devtools) still looks reasonable — no particles snapping to screen-center on release, burst still reads fine at `scale: 1`.
