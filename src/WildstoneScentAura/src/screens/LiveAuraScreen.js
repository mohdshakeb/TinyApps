import { createAuraRenderer } from '../aura/AuraRenderer.js'
import { VaporVariant } from '../aura/VaporVariant.js'
import { createShakeTracker } from '../aura/shakeTracker.js'
import { detectionsToAnchor } from '../tracking/faceAnchor.js'
import { mapCoverPoint, mirrorX } from '../utils/coverCrop.js'
import { captureSnapshot } from '../capture/snapshotCapture.js'
import { startVideoCapture, isVideoCaptureSupported } from '../capture/videoCapture.js'
import { ENABLE_VIDEO_CAPTURE } from '../capture/captureFeatureFlags.js'

const isDebug = new URLSearchParams(location.search).get('debug') === '1'
const LONG_PRESS_MS = 350
const videoCaptureReady = ENABLE_VIDEO_CAPTURE && isVideoCaptureSupported()

export function mountLiveAuraScreen(root, { videoEl, onCapture, onShakeComplete }) {
  videoEl.style.display = 'block'

  const auraCanvas = document.createElement('canvas')
  auraCanvas.className = 'aura-canvas'
  root.appendChild(auraCanvas)
  const renderer = createAuraRenderer(auraCanvas, VaporVariant)
  const shakeTracker = createShakeTracker({ onRoundComplete: onShakeComplete })
  let lastDetectionTime = 0

  const captureBtn = document.createElement('button')
  captureBtn.type = 'button'
  captureBtn.className = 'capture-btn'
  captureBtn.setAttribute('aria-label', 'Capture')
  root.appendChild(captureBtn)

  // Tap = snapshot, long-press = video (PRD). A held press only *becomes* a
  // recording after LONG_PRESS_MS -- a quick tap never starts one, so the
  // 'click' handler below is the tap path. `longPressEngaged` suppresses
  // that same 'click' (which still fires natively after the press releases)
  // once a recording has already handled the capture itself.
  let pressTimer = null
  let longPressEngaged = false
  let activeRecording = null

  function armLongPress() {
    if (!videoCaptureReady) return
    pressTimer = setTimeout(() => {
      pressTimer = null
      longPressEngaged = true
      beginRecording()
    }, LONG_PRESS_MS)
  }

  function beginRecording() {
    captureBtn.classList.add('recording')
    activeRecording = startVideoCapture({ width: auraCanvas.width, height: auraCanvas.height, videoEl, auraCanvas })
    activeRecording.done
      .then((blob) => onCapture(blob))
      .catch((err) => console.error('[videoCapture] failed:', err))
      .finally(() => {
        captureBtn.classList.remove('recording')
        activeRecording = null
      })
  }

  function endPress() {
    if (pressTimer) {
      clearTimeout(pressTimer)
      pressTimer = null
    }
    activeRecording?.stop()
  }

  captureBtn.addEventListener('pointerdown', armLongPress)
  captureBtn.addEventListener('pointerup', endPress)
  captureBtn.addEventListener('pointercancel', endPress)
  captureBtn.addEventListener('pointerleave', endPress)

  captureBtn.addEventListener('click', async () => {
    if (longPressEngaged) {
      longPressEngaged = false // consumed -- the recording's own onCapture already fired
      return
    }
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
      const anchor = detectionsToAnchor(detections, {
        videoWidth: videoEl.videoWidth,
        videoHeight: videoEl.videoHeight,
        displayWidth,
        displayHeight,
      })
      renderer.setAnchor(anchor)

      // Detections arrive at MediaPipe's throttled rate (~15Hz), not per rAF
      // frame, so the shake tracker needs its own dt computed from wall-clock
      // time between calls (mirroring AuraRenderer.js's own lastTime/dt).
      const now = performance.now()
      const dt = lastDetectionTime ? Math.min((now - lastDetectionTime) / 1000, 0.2) : 0
      lastDetectionTime = now
      shakeTracker.update(dt, anchor)
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
      endPress() // stop an in-flight recording rather than leak its rAF loop + open stream
      renderer.stop()
      shakeTracker.reset()
      videoEl.style.display = 'none'
      auraCanvas.remove()
      debugCanvas?.remove()
      captureBtn.remove()
    },
  }
}
