// Wildstone Edge's jagged electric-arc look is replaced by soft floating
// vapor/mist -- particles drift like scent dispersing into the air rather
// than snapping outward like electricity. Idle motion is a gentle upward
// drift + jitter; as the motion-energy signal from AuraRenderer.js rises
// (i.e. during a confident shake), particles blend toward streaming in the
// shake's direction, so a "confident" round visibly looks denser/more
// coherent than a weak one -- the same energy signal drives both scoring
// (shakeTracker.js) and this look, so they can't drift out of sync.

const COLORS = ['#eafcff', '#d6f5ff', '#c9ecec', '#f0faf7']

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

export const VaporVariant = {
  name: 'vapor',
  emissionRate: 45,

  createParticle(originX, originY, scale = 1, width = 0, height = 0, motionEnergy01 = 0, dirX = 0, dirY = 0) {
    const spawnRadius = 0.1 * Math.min(width, height) * scale
    const angle = rand(0, Math.PI * 2)
    const dist = rand(0, spawnRadius)
    const spawnX = originX + Math.cos(angle) * dist
    const spawnY = originY + Math.sin(angle) * dist

    const coherence = motionEnergy01
    const idleVx = rand(-10, 10) * scale
    const idleVy = -rand(8, 20) * scale // slow upward drift, like rising mist
    const streamSpeed = rand(60, 160) * scale
    const streamVx = dirX * streamSpeed
    const streamVy = dirY * streamSpeed - rand(10, 30) * scale // small upward bias even at full energy

    return {
      x: spawnX,
      y: spawnY,
      vx: lerp(idleVx, streamVx, coherence),
      vy: lerp(idleVy, streamVy, coherence),
      drag: rand(0.6, 1.1),
      age: 0,
      maxLife: rand(0.9, 1.6),
      radius: rand(3, 7) * scale,
      baseAlpha: rand(0.35, 0.6),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }
  },

  drawParticle(ctx, p) {
    const alpha = p.baseAlpha * (1 - p.age / p.maxLife)
    if (alpha <= 0) return

    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius)
    gradient.addColorStop(0, p.color)
    gradient.addColorStop(1, 'transparent')

    ctx.globalAlpha = alpha
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
    ctx.fill()
  },
}
