// Variant-agnostic particle pool. A variant supplies only `emissionRate`,
// `createParticle(originX, originY, scale, width, height, motionEnergy01, motionDirX, motionDirY)`,
// and `drawParticle(ctx, particle)` -- this module owns the pool, emission
// timing, and generic velocity/drag/life physics, so Red and Intense Black
// variants can reuse it unchanged. `width`/`height` are passed through so a
// variant can size itself (e.g. a spawn-ring radius) relative to the canvas.
// The `motionEnergy01`/`motionDirX`/`motionDirY` args are optional -- variants
// that don't care about motion can ignore them.

// Deadzone on motion energy so residual anchor-smoothing noise (present even
// when the face/pointer is genuinely still) doesn't dribble particles -- the
// whole point of this gate is "particles only released on shake." Kept low
// deliberately: even a gentle/slow shake should still release *some*
// particles (sparse, per the vapor variant's low-energy look) rather than
// nothing at all -- "no particles" reads as broken, not as "too slow."
const MOTION_GATE_THRESHOLD = 0.02

export function createParticleSystem(variant, { maxParticles = 220 } = {}) {
  let particles = []
  let emitAccumulator = 0

  function update(dt, anchor, width, height, motionEnergy01 = 0, motionDirX = 0, motionDirY = 0) {
    const active = anchor && anchor.confidence > 0.05 && motionEnergy01 > MOTION_GATE_THRESHOLD && width && height
    if (active) {
      emitAccumulator += variant.emissionRate * anchor.confidence * motionEnergy01 * dt
      const originX = anchor.x * width
      const originY = anchor.y * height
      while (emitAccumulator >= 1 && particles.length < maxParticles) {
        particles.push(
          variant.createParticle(originX, originY, anchor.scale, width, height, motionEnergy01, motionDirX, motionDirY)
        )
        emitAccumulator -= 1
      }
    }

    particles = particles.filter((p) => {
      p.age += dt
      if (p.age >= p.maxLife) return false
      const dragFactor = Math.max(0, 1 - p.drag * dt)
      p.vx *= dragFactor
      p.vy *= dragFactor
      p.x += p.vx * dt
      p.y += p.vy * dt
      return true
    })
  }

  function draw(ctx) {
    for (const p of particles) variant.drawParticle(ctx, p)
  }

  function reset() {
    particles = []
    emitAccumulator = 0
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
