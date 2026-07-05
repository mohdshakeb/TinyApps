// Wildstone Edge: "sharp, high-frequency electric blue lightning/energy
// arcs" (PRD 3.1). Each particle is a short jagged polyline shot outward from
// the anchor; particles are created at the anchor's *current* position and
// then drift independently, so fast anchor movement naturally leaves a trail
// of past bursts behind it (the "trailing wisps" from the PRD's motion-
// inertia requirement) without any extra trail-specific code.

const COLORS = ['#e8faff', '#8fe8ff', '#4fc3ff', '#2f8fe0']

function rand(min, max) {
  return min + Math.random() * (max - min)
}

export const EdgeVariant = {
  name: 'edge',
  emissionRate: 70,

  createParticle(originX, originY, scale = 1) {
    const angle = rand(0, Math.PI * 2)
    const speed = rand(180, 380) * scale
    const segments = Math.round(rand(2, 4))
    const length = rand(14, 34) * scale

    const jag = []
    for (let i = 0; i <= segments; i++) {
      jag.push({
        offset: (i / segments) * length,
        jitter: rand(-6, 6) * scale,
      })
    }

    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drag: rand(1.8, 2.6),
      age: 0,
      maxLife: rand(0.28, 0.55),
      angle,
      jag,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      width: rand(1.5, 2.5) * scale,
    }
  },

  drawParticle(ctx, p) {
    const alpha = 1 - p.age / p.maxLife
    if (alpha <= 0) return

    const dirX = Math.cos(p.angle)
    const dirY = Math.sin(p.angle)
    const normX = -dirY
    const normY = dirX

    ctx.globalAlpha = alpha
    ctx.strokeStyle = p.color
    ctx.lineWidth = p.width
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    p.jag.forEach((point, i) => {
      const px = p.x + dirX * point.offset + normX * point.jitter
      const py = p.y + dirY * point.offset + normY * point.jitter
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()
  },
}
