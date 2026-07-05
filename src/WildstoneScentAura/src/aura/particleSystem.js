// Variant-agnostic particle pool. A variant supplies only `emissionRate`,
// `createParticle(originX, originY, scale, width, height)`, and
// `drawParticle(ctx, particle)` -- this module owns the pool, emission
// timing, and generic velocity/drag/life physics, so Red and Intense Black
// variants can reuse it unchanged. `width`/`height` are passed through so a
// variant can size itself (e.g. a spawn-ring radius) relative to the canvas.

export function createParticleSystem(variant, { maxParticles = 220 } = {}) {
  let particles = []
  let emitAccumulator = 0

  function update(dt, anchor, width, height) {
    if (anchor && anchor.confidence > 0.05 && width && height) {
      emitAccumulator += variant.emissionRate * anchor.confidence * dt
      const originX = anchor.x * width
      const originY = anchor.y * height
      while (emitAccumulator >= 1 && particles.length < maxParticles) {
        particles.push(variant.createParticle(originX, originY, anchor.scale, width, height))
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
