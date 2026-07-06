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

// Session 10 (client feedback: "water shaking off after a bath," not "bubbles
// popping in anywhere"): the burst is now a gravity-affected spray-cone fanned
// out around the current shake direction, rather than a soft lerp between an
// idle drift and a directional stream.
const SPRAY_HALF_ANGLE_RAD = 0.78 // ~45 degrees -- cone width of the flick
const SPRAY_SPEED_MIN = 140 // px/s at scale 1, before the energy multiplier
const SPRAY_SPEED_MAX = 320 // px/s at scale 1, before the energy multiplier
const GRAVITY_PX_S2 = 260 // downward arc during the burst phase

function rand(min, max) {
  return min + Math.random() * (max - min)
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
    const ellipseY = originY + faceSize * 0.3
    const radiusX = faceSize * rand(0.6, 1.1)
    const radiusY = faceSize * rand(0.5, 0.9)
    const angle = rand(0, Math.PI * 2)
    const r = Math.sqrt(Math.random()) // uniform-density disc sampling, not clustered at center
    const spawnX = ellipseX + Math.cos(angle) * radiusX * r
    const spawnY = ellipseY + Math.sin(angle) * radiusY * r

    // Fan out around the current shake direction like flung water droplets;
    // fall back to a mostly-upward cone when there's no clear direction yet
    // (the very start of a shake, before AuraRenderer.js has a motion vector).
    const hasDirection = dirX !== 0 || dirY !== 0
    const baseAngle = hasDirection ? Math.atan2(dirY, dirX) : -Math.PI / 2
    const sprayAngle = baseAngle + rand(-SPRAY_HALF_ANGLE_RAD, SPRAY_HALF_ANGLE_RAD)
    // Energy multiplier has its own floor (0.7) so even a barely-there shake
    // still flicks with real force -- the "strong floor" is what keeps this
    // from ever reading as a weak dribble.
    const energyMultiplier = 0.7 + 0.3 * motionEnergy01
    const speed = rand(SPRAY_SPEED_MIN, SPRAY_SPEED_MAX) * energyMultiplier * scale

    return {
      x: spawnX,
      y: spawnY,
      vx: Math.cos(sprayAngle) * speed,
      vy: Math.sin(sprayAngle) * speed,
      drag: rand(0.6, 1.1),
      gravity: GRAVITY_PX_S2 * scale,
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
