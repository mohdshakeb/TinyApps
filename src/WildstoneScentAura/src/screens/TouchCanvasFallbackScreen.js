import { createAuraRenderer } from '../aura/AuraRenderer.js'
import { EdgeVariant } from '../aura/EdgeVariant.js'
import { createTouchAuraController } from '../touchCanvas/touchAuraController.js'
import { captureSnapshot } from '../capture/snapshotCapture.js'

export function mountTouchCanvasFallbackScreen(root, { onCapture }) {
  const el = document.createElement('div')
  el.className = 'screen-fallback'
  el.innerHTML = `
    <canvas class="aura-canvas"></canvas>
    <div class="fallback-hint">
      <h2 class="fallback-title">Camera unavailable</h2>
      <p class="fallback-subtitle">Drag your finger across the screen to shape the aura instead.</p>
    </div>
    <button type="button" class="capture-btn" aria-label="Capture"></button>
  `
  root.appendChild(el)

  const canvas = el.querySelector('canvas')
  const renderer = createAuraRenderer(canvas, EdgeVariant)

  el.querySelector('.capture-btn').addEventListener('click', async () => {
    const blob = await captureSnapshot({ width: canvas.width, height: canvas.height, videoEl: null, auraCanvas: canvas })
    onCapture(blob)
  })

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
