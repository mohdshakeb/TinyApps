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
// above and the settled-particle follow logic below (same underlying
// question: "is this anchor reading trustworthy enough to act on").
const ANCHOR_TRUST_THRESHOLD = 0.05

// Fraction of the anchor's own frame-to-frame movement applied to settled
// particles (Session 10: "particles should feel loosely attracted to the
// person"). This is a *delta* nudge, not a lerp toward the anchor's absolute
// position -- particles are scattered around the head, not on it, so nudging
// by the anchor's own movement keeps each particle's relative offset intact
// while the whole floating cluster drifts along with the person.
const FOLLOW_GAIN = 0.25

export function createParticleSystem(variant, { maxParticles = 400 } = {}) {
  let particles = []
  let emitAccumulator = 0
  let clock = 0 // free-running time, used for the idle-float phase's bob cycle
  let lastAnchorNormX = null
  let lastAnchorNormY = null

  function update(dt, anchor, width, height, motionEnergy01 = 0, motionDirX = 0, motionDirY = 0) {
    clock += dt
    const anchorTrusted = anchor && anchor.confidence > ANCHOR_TRUST_THRESHOLD
    const active = anchorTrusted && motionEnergy01 > MOTION_GATE_THRESHOLD && width && height

    // Settled-particle follow nudge, computed once per frame (not once per
    // particle). Gated on the anchor being trustworthy *this frame and last
    // frame* -- if tracking was just lost or just regained (or, on Touch
    // Canvas, the pointer released back to the neutral center anchor), there
    // is no reliable "movement since last frame" to follow, so the nudge is
    // zeroed and the last-seen position is cleared rather than left stale.
    let followDx = 0
    let followDy = 0
    if (anchorTrusted && width && height) {
      if (lastAnchorNormX !== null && lastAnchorNormY !== null) {
        followDx = (anchor.x - lastAnchorNormX) * width * FOLLOW_GAIN
        followDy = (anchor.y - lastAnchorNormY) * height * FOLLOW_GAIN
      }
      lastAnchorNormX = anchor.x
      lastAnchorNormY = anchor.y
    } else {
      lastAnchorNormX = null
      lastAnchorNormY = null
    }

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
        p.vy += (p.gravity || 0) * dt
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
    lastAnchorNormX = null
    lastAnchorNormY = null
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
