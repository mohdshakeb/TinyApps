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

// Session 10.2 (match `docs/references/image.png`): that reference is
// mostly warm-white pinpoint sparkle with only occasional saturated color --
// not an even split across six fully-saturated hues. Weighted by duplicate
// entries (simplest way to bias `rand`-style array indexing without a
// separate weighting table) rather than an even distribution.
const COLORS = [
  '#ffffff',
  '#ffffff',
  '#ffffff',
  '#fff4d9',
  '#fff4d9',
  '#ffcf5c',
  '#ff5fa2',
  '#7c5cff',
  '#3ec9ff',
  '#2fe6c0',
]

const FADE_IN_TIME = 0.15 // seconds -- avoids a hard pop-in at spawn; there's no fade-out anymore

// A small fraction of particles render larger and brighter -- "hero"
// sparkles that give the field some depth/focal points, matching the
// reference's mix of tiny pinpricks and a few standout stars, rather than
// every particle being the same size.
const HERO_CHANCE = 0.12

// Session 10 (client feedback: "water shaking off after a bath," not "bubbles
// popping in anywhere"): the burst scatters outward in every direction, like
// a firework, rather than a soft lerp between an idle drift and a directional
// stream. Session 10.1 (real-device retest): an earlier version of this
// biased the burst angle toward the current shake direction and added
// gravity -- on a real left-right head shake that collapsed into two narrow
// horizontal cones that then fell like dropped balls once gravity outlasted
// the initial speed. Fully isotropic + no gravity reads as "scatter in all
// directions," matching what was actually asked for.
const SPRAY_SPEED_MIN = 140 // px/s at scale 1, before the energy multiplier
const SPRAY_SPEED_MAX = 320 // px/s at scale 1, before the energy multiplier

function rand(min, max) {
  return min + Math.random() * (max - min)
}

export const VaporVariant = {
  name: 'vapor',
  // Session 10.2: the reference is a sparse constellation (~25-40 visible
  // points), not a dense swarm -- particles never die (they hand off to
  // particleSystem.js's idle-float phase), so a high rate against a long
  // 10s capture used to saturate the pool cap and read as cluttered rather
  // than sparse. Slowed down so the field builds gradually instead.
  emissionRate: 10,

  createParticle(originX, originY, scale = 1, width = 0, height = 0, motionEnergy01 = 0, dirX = 0, dirY = 0) {
    // "Around the person, not on the face": sample from an ellipse offset
    // downward from the face anchor (toward where shoulders/chest would be),
    // sized off `scale` (a proxy for the face's on-screen size) rather than a
    // small fixed-radius ring centered on the face itself. Session 10.2:
    // widened from Session 10's head-hugging ellipse -- now that the burst
    // is isotropic and gravity-free (Session 10.1), a tighter spawn no
    // longer needs to do all the work of keeping particles near the person;
    // this wider region matches the reference's spread from above the head
    // down past the shoulders.
    const faceSize = 0.12 * Math.min(width, height) * scale
    const ellipseX = originX
    const ellipseY = originY + faceSize * 1.2
    const radiusX = faceSize * rand(1.2, 2.2)
    const radiusY = faceSize * rand(1.5, 3)
    const angle = rand(0, Math.PI * 2)
    const r = Math.sqrt(Math.random()) // uniform-density disc sampling, not clustered at center
    const spawnX = ellipseX + Math.cos(angle) * radiusX * r
    const spawnY = ellipseY + Math.sin(angle) * radiusY * r

    // Full 360-degree scatter -- each particle picks its own independent
    // direction, so the burst as a whole reads as an omnidirectional flick
    // rather than a stream aimed one way. `dirX`/`dirY` (the current shake
    // direction) are intentionally unused here now -- see the file header.
    const sprayAngle = rand(0, Math.PI * 2)
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

      // Session 10.2: mostly tiny pinpoint sparkles with a rare larger "hero"
      // (was a single narrow range that read as uniform blobs, not the
      // reference's mix of pinpricks and a few standout stars).
      radius: (Math.random() < HERO_CHANCE ? rand(4, 6.5) : rand(1.2, 2.8)) * scale,
      baseAlpha: rand(0.55, 0.85),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }
  },

  drawParticle(ctx, p) {
    const alpha = p.baseAlpha * Math.min(1, p.age / FADE_IN_TIME)
    if (alpha <= 0) return

    // Tighter glow falloff than the old bubble look (color held through only
    // 20% of the radius before fading) so this reads as a twinkling star
    // point rather than a soft translucent orb.
    const glowRadius = p.radius * 1.6
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius)
    gradient.addColorStop(0, p.color)
    gradient.addColorStop(0.2, p.color)
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
