// Drives the same `{ x, y, scale, confidence }` anchor shape as
// tracking/faceAnchor.js, but from finger-drag input -- lets the Touch
// Canvas fallback reuse AuraRenderer/EdgeVariant unchanged (see
// Planning/CONTEXT.md's shared-anchor-interface decision).

const NEUTRAL_ANCHOR = { x: 0.5, y: 0.5, scale: 1, confidence: 0 }

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

export function createTouchAuraController(el, { onAnchor }) {
  let active = false

  function handleDown(e) {
    active = true
    el.setPointerCapture?.(e.pointerId)
    handleMove(e)
  }

  function handleMove(e) {
    // Mouse pointers fire `pointermove` on hover, not just while pressed --
    // gate on `active` so this stays "drag" and doesn't emit on idle hover.
    if (!active) return
    onAnchor({
      x: clamp01(e.clientX / window.innerWidth),
      y: clamp01(e.clientY / window.innerHeight),
      scale: 1,
      confidence: 1,
    })
  }

  function handleUp() {
    active = false
    onAnchor(NEUTRAL_ANCHOR)
  }

  el.addEventListener('pointerdown', handleDown)
  el.addEventListener('pointermove', handleMove)
  el.addEventListener('pointerup', handleUp)
  el.addEventListener('pointercancel', handleUp)

  return {
    destroy() {
      el.removeEventListener('pointerdown', handleDown)
      el.removeEventListener('pointermove', handleMove)
      el.removeEventListener('pointerup', handleUp)
      el.removeEventListener('pointercancel', handleUp)
    },
  }
}
