import { createAuraRenderer } from '../aura/AuraRenderer.js'
import { EdgeVariant } from '../aura/EdgeVariant.js'
import { detectionsToAnchor } from '../tracking/faceAnchor.js'
import { mapCoverPoint, mirrorX } from '../utils/coverCrop.js'
import { captureSnapshot } from '../capture/snapshotCapture.js'

const isDebug = new URLSearchParams(location.search).get('debug') === '1'

export function mountLiveAuraScreen(root, { videoEl, onCapture }) {
  videoEl.style.display = 'block'

  const auraCanvas = document.createElement('canvas')
  auraCanvas.className = 'aura-canvas'
  root.appendChild(auraCanvas)
  const renderer = createAuraRenderer(auraCanvas, EdgeVariant)

  const captureBtn = document.createElement('button')
  captureBtn.type = 'button'
  captureBtn.className = 'capture-btn'
  captureBtn.setAttribute('aria-label', 'Capture')
  root.appendChild(captureBtn)
  captureBtn.addEventListener('click', async () => {
    const blob = await captureSnapshot({ width: auraCanvas.width, height: auraCanvas.height, videoEl, auraCanvas })
    onCapture(blob)
  })

  // The bounding-box overlay is a diagnostic tool, not part of the demo --
  // only mount it under `?debug=1` so the aura itself is what's visible live.
  let debugCanvas = null
  let debugCtx = null
  if (isDebug) {
    debugCanvas = document.createElement('canvas')
    debugCanvas.className = 'debug-bbox-canvas'
    root.appendChild(debugCanvas)
    debugCtx = debugCanvas.getContext('2d')
  }

  function resize() {
    renderer.resize()
    if (debugCanvas) {
      debugCanvas.width = debugCanvas.clientWidth
      debugCanvas.height = debugCanvas.clientHeight
    }
  }
  resize()
  window.addEventListener('resize', resize)
  renderer.start()

  function drawDetections(detections) {
    const displayWidth = auraCanvas.clientWidth
    const displayHeight = auraCanvas.clientHeight

    if (videoEl.videoWidth) {
      renderer.setAnchor(
        detectionsToAnchor(detections, {
          videoWidth: videoEl.videoWidth,
          videoHeight: videoEl.videoHeight,
          displayWidth,
          displayHeight,
        })
      )
    }

    if (!debugCtx) return
    debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height)
    if (!videoEl.videoWidth) return

    debugCtx.strokeStyle = '#9fffb0'
    debugCtx.lineWidth = 2
    for (const { boundingBox: box } of detections) {
      if (!box) continue
      const { x, y, coverScale } = mapCoverPoint(box.originX, box.originY, videoEl.videoWidth, videoEl.videoHeight, displayWidth, displayHeight)
      const w = box.width * coverScale
      const h = box.height * coverScale
      debugCtx.strokeRect(mirrorX(x + w, displayWidth), y, w, h)
    }
  }

  return {
    drawDetections,
    unmount() {
      window.removeEventListener('resize', resize)
      renderer.stop()
      videoEl.style.display = 'none'
      auraCanvas.remove()
      debugCanvas?.remove()
      captureBtn.remove()
    },
  }
}
