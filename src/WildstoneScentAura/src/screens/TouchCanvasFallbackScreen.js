import { createAuraRenderer } from '../aura/AuraRenderer.js'
import { VaporVariant } from '../aura/VaporVariant.js'
import { createTouchAuraController } from '../touchCanvas/touchAuraController.js'

// Insurance-only screen: conveys that the camera is required and gives a
// finger-drag aura to play with meanwhile, but doesn't offer capture/share --
// that flow stays gated on a real camera feed.
export function mountTouchCanvasFallbackScreen(root) {
  const el = document.createElement('div')
  el.className = 'screen-fallback'
  el.innerHTML = `
    <canvas class="aura-canvas"></canvas>
    <div class="fallback-hint">
      <h2 class="fallback-title">Camera unavailable</h2>
      <p class="fallback-subtitle">Drag your finger across the screen to shape the aura instead.</p>
    </div>
  `
  root.appendChild(el)

  const canvas = el.querySelector('canvas')
  const renderer = createAuraRenderer(canvas, VaporVariant)

  function resize() {
    renderer.resize()
  }
  resize()
  window.addEventListener('resize', resize)
  renderer.start()

  const controller = createTouchAuraController(canvas, {
    onAnchor: (anchor) => renderer.setAnchor(anchor),
  })

  return {
    unmount() {
      window.removeEventListener('resize', resize)
      renderer.stop()
      controller.destroy()
      el.remove()
    },
  }
}
