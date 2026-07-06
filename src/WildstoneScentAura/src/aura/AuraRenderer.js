import { createParticleSystem } from './particleSystem.js'

const NEUTRAL_ANCHOR = { x: 0.5, y: 0.5, scale: 1, confidence: 0 }
const SMOOTHING = 0.22 // per-frame lerp factor toward the latest anchor
const MAX_DT = 0.05 // clamp dt so a tab coming back from background doesn't spawn a burst

// Motion-energy signal: how fast the anchor is actually moving, in
// normalized-display-units/sec, clamped into a 0-1 range. This is the
// generic "is something shaking right now" signal particleSystem.js gates
// emission on -- deliberately computed here rather than in a separate
// module, since this is the one place cross-frame anchor state exists in
// this codebase.
//
// Measured from raw anchor arrivals (in `setAnchor`, diffed against the
// previous raw anchor over the real wall-clock time between updates), NOT
// from `smoothedAnchor`'s per-frame lerp -- diffing the lerped render value
// would measure a diluted fraction of the real movement, since a single real
// detection update only nudges `smoothedAnchor` partway there over several
// render frames. At the ~15Hz throttled face-detection rate that dilution is
// severe enough to make real head-shake motion nearly invisible to the gate.
const ENERGY_RISE_ALPHA = 0.5 // how much a fresh raw sample pulls energy toward it
const ENERGY_DECAY_PER_SEC = 4 // exponential decay applied every render frame
const ENERGY_MAX = 3 // clamp ceiling for raw (unsmoothed) anchor speed

// Canvas2D implementation behind the swappable `AuraRenderer` seam (see
// Planning/CONTEXT.md). Runs its own rAF loop independent of the ~15Hz
// detection rate -- `setAnchor` just updates a target, and each frame lerps
// toward it, so motion reads as smooth 60fps even though real anchor updates
// arrive far less often (face detection) or at native pointer rate (touch).
export function createAuraRenderer(canvas, variant) {
  const ctx = canvas.getContext('2d')
  const particleSystem = createParticleSystem(variant)

  let width = 0
  let height = 0
  let targetAnchor = NEUTRAL_ANCHOR
  let smoothedAnchor = { ...NEUTRAL_ANCHOR }
  let rafId = null
  let lastTime = 0

  // Defaults to true so callers that never touch this (Touch Canvas
  // fallback) keep today's always-on-while-moving behavior unchanged.
  // LiveAuraScreen.js is the one caller that flips this off/on around its
  // idle vs. "released" sub-states (Session 9).
  let armed = true

  // Raw (unsmoothed) motion tracking -- separate from smoothedAnchor above,
  // which is purely a rendering concern.
  let lastRawAnchor = null
  let lastRawAnchorTime = 0
  let motionEnergy = 0
  let motionDirX = 0
  let motionDirY = 0

  function resize() {
    const dpr = window.devicePixelRatio || 1
    // Keep `width`/`height` (used by every draw call below) in CSS-pixel
    // logical space; size the actual backing store up by dpr and scale the
    // context to match, so the canvas renders crisply on real 2-3x DPR
    // phone screens instead of at 1 canvas-px-per-CSS-px softness.
    width = canvas.clientWidth
    height = canvas.clientHeight
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function setAnchor(anchor) {
    // Measure real motion here, at the moment a fresh detection/pointer
    // sample actually arrives -- using the true wall-clock gap since the
    // last sample, not the render frame's dt (which has nothing to do with
    // how often real anchor updates land).
    const now = performance.now()
    if (lastRawAnchor && lastRawAnchorTime) {
      const rawDt = (now - lastRawAnchorTime) / 1000
      if (rawDt > 0.001) {
        const dx = anchor.x - lastRawAnchor.x
        const dy = anchor.y - lastRawAnchor.y
        const mag = Math.hypot(dx, dy)
        const rawSpeed = mag / rawDt
        motionEnergy = Math.min(motionEnergy + (rawSpeed - motionEnergy) * ENERGY_RISE_ALPHA, ENERGY_MAX)
        if (mag > 1e-4) {
          motionDirX = dx / mag
          motionDirY = dy / mag
        }
      }
    }
    lastRawAnchor = anchor
    lastRawAnchorTime = now
    targetAnchor = anchor
  }

  function frame(now) {
    const dt = lastTime ? Math.min((now - lastTime) / 1000, MAX_DT) : 0
    lastTime = now

    smoothedAnchor = {
      x: smoothedAnchor.x + (targetAnchor.x - smoothedAnchor.x) * SMOOTHING,
      y: smoothedAnchor.y + (targetAnchor.y - smoothedAnchor.y) * SMOOTHING,
      scale: smoothedAnchor.scale + (targetAnchor.scale - smoothedAnchor.scale) * SMOOTHING,
      confidence: targetAnchor.confidence,
    }

    // Decay motion energy every render frame so it falls back to ~0 shortly
    // after real motion stops, independent of how often setAnchor fires.
    if (dt > 0) motionEnergy *= Math.exp(-ENERGY_DECAY_PER_SEC * dt)
    const energy01 = Math.min(1, motionEnergy / ENERGY_MAX)

    ctx.clearRect(0, 0, width, height)
    // Forcing energy to 0 while unarmed (rather than skipping `update`
    // entirely) still ages/floats existing particles normally -- only new
    // emission is gated.
    particleSystem.update(dt, smoothedAnchor, width, height, armed ? energy01 : 0, motionDirX, motionDirY)

    ctx.save()
    ctx.globalCompositeOperation = 'lighter' // cheap additive glow, no per-particle shadowBlur cost
    particleSystem.draw(ctx)
    ctx.restore()

    rafId = requestAnimationFrame(frame)
  }

  function start() {
    resize()
    lastTime = 0
    lastRawAnchor = null
    lastRawAnchorTime = 0
    motionEnergy = 0
    motionDirX = 0
    motionDirY = 0
    if (!rafId) rafId = requestAnimationFrame(frame)
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = null
    particleSystem.reset()
  }

  function setArmed(value) {
    armed = value
  }

  return { start, stop, resize, setAnchor, setArmed }
}
