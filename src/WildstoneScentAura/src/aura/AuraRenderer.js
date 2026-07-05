import { createParticleSystem } from './particleSystem.js'

const NEUTRAL_ANCHOR = { x: 0.5, y: 0.5, scale: 1, confidence: 0 }
const SMOOTHING = 0.22 // per-frame lerp factor toward the latest anchor
const MAX_DT = 0.05 // clamp dt so a tab coming back from background doesn't spawn a burst

// Canvas2D implementation behind the swappable `AuraRenderer` seam (see
// Planning/CONTEXT.md). Runs its own rAF loop independent of the ~15Hz
// detection rate -- `setAnchor` just updates a target, and each frame lerps
// toward it, so motion reads as smooth 60fps even though real anchor updates
// arrive far less often (face detection) or at native pointer rate (touch).
export function createAuraRenderer(canvas, variant) {
  const ctx = canvas.getContext('2d')
  const particleSystem = createParticleSystem(variant)

  let width = 0
  let height = 0
  let targetAnchor = NEUTRAL_ANCHOR
  let smoothedAnchor = { ...NEUTRAL_ANCHOR }
  let rafId = null
  let lastTime = 0

  function resize() {
    width = canvas.width = canvas.clientWidth
    height = canvas.height = canvas.clientHeight
  }

  function setAnchor(anchor) {
    targetAnchor = anchor
  }

  function frame(now) {
    const dt = lastTime ? Math.min((now - lastTime) / 1000, MAX_DT) : 0
    lastTime = now

    smoothedAnchor = {
      x: smoothedAnchor.x + (targetAnchor.x - smoothedAnchor.x) * SMOOTHING,
      y: smoothedAnchor.y + (targetAnchor.y - smoothedAnchor.y) * SMOOTHING,
      scale: smoothedAnchor.scale + (targetAnchor.scale - smoothedAnchor.scale) * SMOOTHING,
      confidence: targetAnchor.confidence,
    }

    ctx.clearRect(0, 0, width, height)
    particleSystem.update(dt, smoothedAnchor, width, height)

    ctx.save()
    ctx.globalCompositeOperation = 'lighter' // cheap additive glow, no per-particle shadowBlur cost
    particleSystem.draw(ctx)
    ctx.restore()

    rafId = requestAnimationFrame(frame)
  }

  function start() {
    resize()
    lastTime = 0
    if (!rafId) rafId = requestAnimationFrame(frame)
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = null
    particleSystem.reset()
  }

  return { start, stop, resize, setAnchor }
}
