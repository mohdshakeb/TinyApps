// Wildstone Edge: "sharp, high-frequency electric blue lightning/energy
// arcs" (PRD 3.1). Particles spawn on a ring around the anchor -- sized to
// roughly trace the face's silhouette -- rather than at the anchor's exact
// center, so the aura reads as a halo *around* the face instead of a burst
// erupting on top of it. From that ring, each particle is a short jagged
// polyline continuing radially outward, then drifts independently, so fast
// anchor movement naturally leaves a trail of past bursts behind it (the
// "trailing wisps" from the PRD's motion-inertia requirement) without any
// extra trail-specific code.

const COLORS = ['#e8faff', '#8fe8ff', '#4fc3ff', '#2f8fe0']

// Ring radius as a fraction of min(canvas dimension), scaled by anchor.scale
// -- tuned to sit just outside a real face's silhouette; expect this needs
// adjusting once seen on a phone (see PROGRESS.md).
const RING_RADIUS_FRACTION = 0.18

function rand(min, max) {
  return min + Math.random() * (max - min)
}

export const EdgeVariant = {
  name: 'edge',
  emissionRate: 70,

  createParticle(originX, originY, scale = 1, width = 0, height = 0) {
    const angle = rand(0, Math.PI * 2)
    const ringRadius = RING_RADIUS_FRACTION * Math.min(width, height) * scale
    const spawnX = originX + Math.cos(angle) * ringRadius
    const spawnY = originY + Math.sin(angle) * ringRadius

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
      x: spawnX,
      y: spawnY,
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
