// Variant-agnostic particle pool. A variant supplies only `emissionRate`,
// `createParticle(originX, originY, scale, width, height, motionEnergy01, motionDirX, motionDirY)`,
// and `drawParticle(ctx, particle)` -- this module owns the pool, emission
// timing, and generic physics, so other variants can reuse it unchanged.
// `width`/`height` are passed through so a variant can size itself (e.g. a
// spawn-region radius) relative to the canvas. The `motionEnergy01`/
// `motionDirX`/`motionDirY` args are optional -- variants that don't care
// about motion can ignore them.
//
// Physics has two phases per particle, driven by `p.settleTime` (set by the
// variant, e.g. VaporVariant's initial burst/drift duration): before it, the
// particle drifts under its spawn velocity + drag, same as before; after it,
// the particle stops dying and instead settles into a slow idle bob/drift
// around wherever it came to rest (Session 9: "released particles should
// remain on screen, floating around the person" -- particles used to fully
// fade out and get removed once `age >= maxLife`).

// Deadzone on motion energy so residual anchor-smoothing noise (present even
// when the face/pointer is genuinely still) doesn't dribble particles -- the
// whole point of this gate is "particles only released on shake." Kept low
// deliberately: even a gentle/slow shake should still release *some*
// particles (sparse, per the vapor variant's low-energy look) rather than
// nothing at all -- "no particles" reads as broken, not as "too slow."
const MOTION_GATE_THRESHOLD = 0.02

// Confidence floor to trust an anchor reading -- shared by the emission gate
// below and (in AuraRenderer.js) the gate on accumulating a settled-particle
// follow delta from raw anchor arrivals (same underlying question: "is this
// anchor reading trustworthy enough to act on").
export const ANCHOR_TRUST_THRESHOLD = 0.05

// Fraction of the anchor's own raw movement applied to settled particles
// (Session 10: "particles should feel loosely attracted to the person").
// This is a *delta* nudge, not a lerp toward the anchor's absolute position
// -- particles are scattered around the head, not on it, so nudging by the
// anchor's own movement keeps each particle's relative offset intact while
// the whole floating cluster drifts along with the person.
const FOLLOW_GAIN = 0.25

// Session 10.2: lowered from 400 -- particles never die (see file header),
// so the pool cap is effectively "how dense does the field get by the end of
// a long capture." 400 read as a dense swarm; the reference this is matching
// (docs/references/image.png) is a sparse constellation of ~25-40 points.
export function createParticleSystem(variant, { maxParticles = 70 } = {}) {
  let particles = []
  let emitAccumulator = 0
  let clock = 0 // free-running time, used for the idle-float phase's bob cycle

  // `followDxNorm`/`followDyNorm`: the anchor's raw movement (normalized 0-1
  // display-space units) accumulated since the last call, computed by
  // AuraRenderer.js from actual detection/pointer arrivals -- NOT derived
  // here from the `anchor` param, which is the render-smoothed anchor and
  // moves only a fraction of the way toward each real update per frame (the
  // same dilution documented in AuraRenderer.js for the motion-energy
  // signal). Using the smoothed value here made settled particles barely
  // seem to follow at all.
  function update(dt, anchor, width, height, motionEnergy01 = 0, motionDirX = 0, motionDirY = 0, followDxNorm = 0, followDyNorm = 0) {
    clock += dt
    const active = anchor && anchor.confidence > ANCHOR_TRUST_THRESHOLD && motionEnergy01 > MOTION_GATE_THRESHOLD && width && height
    const followDx = followDxNorm * width * FOLLOW_GAIN
    const followDy = followDyNorm * height * FOLLOW_GAIN

    if (active) {
      emitAccumulator += variant.emissionRate * anchor.confidence * motionEnergy01 * dt
      const originX = anchor.x * width
      const originY = anchor.y * height
      while (emitAccumulator >= 1) {
        // Particles no longer die on their own (see file header), so without
        // this the pool would grow unbounded over a long capture -- oldest
        // particles (front of the array, since we only ever push) are
        // evicted first to make room, same "make room for the newest" rule
        // a death-based cull used to enforce implicitly.
        if (particles.length >= maxParticles) particles.shift()
        particles.push(
          variant.createParticle(originX, originY, anchor.scale, width, height, motionEnergy01, motionDirX, motionDirY)
        )
        emitAccumulator -= 1
      }
    }

    for (const p of particles) {
      p.age += dt
      if (p.age < p.settleTime) {
        const dragFactor = Math.max(0, 1 - p.drag * dt)
        p.vx *= dragFactor
        p.vy *= dragFactor
        p.x += p.vx * dt
        p.y += p.vy * dt
      } else {
        if (!p.settled) {
          p.settleX = p.x
          p.settleY = p.y
          p.settled = true
        } else {
          p.settleX += followDx
          p.settleY += followDy
        }
        const t = clock * p.floatSpeed + p.floatPhase
        p.x = p.settleX + Math.sin(t) * p.floatRadiusX
        p.y = p.settleY + Math.cos(t * 0.8) * p.floatRadiusY - p.driftY * (p.age - p.settleTime)
      }
    }
  }

  function draw(ctx) {
    for (const p of particles) variant.drawParticle(ctx, p)
  }

  function reset() {
    particles = []
    emitAccumulator = 0
    clock = 0
  }

  return {
    update,
    draw,
    reset,
    get count() {
      return particles.length
    },
  }
}
