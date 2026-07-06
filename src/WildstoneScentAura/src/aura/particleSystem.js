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

export function createParticleSystem(variant, { maxParticles = 400 } = {}) {
  let particles = []
  let emitAccumulator = 0
  let clock = 0 // free-running time, used for the idle-float phase's bob cycle

  function update(dt, anchor, width, height, motionEnergy01 = 0, motionDirX = 0, motionDirY = 0) {
    clock += dt
    const active = anchor && anchor.confidence > 0.05 && motionEnergy01 > MOTION_GATE_THRESHOLD && width && height
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
