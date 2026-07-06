// Colorful sparkles released around the person on a head-shake -- not the
// soft pale "bubble" look this replaced (client feedback: match the
// reference's scattered, saturated bokeh-light look). Particles still burst
// outward under drag like the old vapor look, but spawn across a region
// offset down/around the face anchor instead of a tight ring on the face
// itself (there's no body/pose tracking here, so this is a spawn-distribution
// estimate off the one signal available -- face position + size -- not a
// silhouette-aware placement), and once their burst/drift settles they don't
// die: they hand off to particleSystem.js's idle-float phase so the aura
// keeps floating around the person for the rest of the capture.

const COLORS = ['#ff5fa2', '#7c5cff', '#3ec9ff', '#2fe6c0', '#ffcf5c', '#ffffff']

const FADE_IN_TIME = 0.15 // seconds -- avoids a hard pop-in at spawn; there's no fade-out anymore

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
    // "Around the person, not on the face": sample from an ellipse offset
    // downward from the face anchor (toward where shoulders/chest would be),
    // sized off `scale` (a proxy for the face's on-screen size) rather than a
    // small fixed-radius ring centered on the face itself.
    const faceSize = 0.12 * Math.min(width, height) * scale
    const ellipseX = originX
    const ellipseY = originY + faceSize * 2.5
    const radiusX = faceSize * rand(2.5, 4)
    const radiusY = faceSize * rand(3, 6)
    const angle = rand(0, Math.PI * 2)
    const r = Math.sqrt(Math.random()) // uniform-density disc sampling, not clustered at center
    const spawnX = ellipseX + Math.cos(angle) * radiusX * r
    const spawnY = ellipseY + Math.sin(angle) * radiusY * r

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

      // Burst/drift phase length -- after this, particleSystem.js hands the
      // particle to its idle-float phase instead of killing it.
      settleTime: rand(0.9, 1.6),
      settled: false,
      settleX: 0,
      settleY: 0,
      floatSpeed: rand(0.6, 1.4),
      floatPhase: rand(0, Math.PI * 2),
      floatRadiusX: rand(4, 14) * scale,
      floatRadiusY: rand(4, 14) * scale,
      driftY: rand(2, 6) * scale, // slow continued upward drift once idle

      radius: rand(2.5, 5) * scale,
      baseAlpha: rand(0.55, 0.85),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }
  },

  drawParticle(ctx, p) {
    const alpha = p.baseAlpha * Math.min(1, p.age / FADE_IN_TIME)
    if (alpha <= 0) return

    // Colored glow with a tighter falloff than the old bubble look (color
    // held through 35% of the radius before fading), plus a small bright
    // core -- the combination is what reads as a glinting sparkle rather
    // than a soft translucent orb.
    const glowRadius = p.radius * 2.2
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius)
    gradient.addColorStop(0, p.color)
    gradient.addColorStop(0.35, p.color)
    gradient.addColorStop(1, 'transparent')

    ctx.globalAlpha = alpha
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.radius * 0.35, 0, Math.PI * 2)
    ctx.fill()
  },
}
