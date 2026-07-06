import { createAuraRenderer } from '../aura/AuraRenderer.js'
import { VaporVariant } from '../aura/VaporVariant.js'
import { createShakeTracker } from '../aura/shakeTracker.js'
import { detectionsToAnchor } from '../tracking/faceAnchor.js'
import { mapCoverPoint, mirrorX } from '../utils/coverCrop.js'
import { startVideoCapture, isVideoCaptureSupported } from '../capture/videoCapture.js'
import { ENABLE_VIDEO_CAPTURE } from '../capture/captureFeatureFlags.js'

const isDebug = new URLSearchParams(location.search).get('debug') === '1'
// Video is the sole capture path now (no snapshot fallback) -- unlike the
// old long-press gesture, which just quietly stayed snapshot-only if this
// were false, there's no fallback left to fall back to, so an unsupported
// browser needs to visibly disable the button rather than throw once tapped.
const videoCaptureReady = ENABLE_VIDEO_CAPTURE && isVideoCaptureSupported()

// Session 9 pivot: LIVE_AURA now has two sub-states instead of always being
// "hot" -- idle (camera + face tracking live, particles/shakeTracker gated
// off, "Release your aura" shown) and armed (tapping the button opens the
// particle gate, starts shakeTracker, and auto-starts a fixed 10s scored
// recording, all at once). The old always-on tap=snapshot/long-press=video
// capture button is gone entirely -- this is the sole capture trigger now.
export function mountLiveAuraScreen(root, { videoEl, onCapture }) {
  videoEl.style.display = 'block'

  const auraCanvas = document.createElement('canvas')
  auraCanvas.className = 'aura-canvas'
  root.appendChild(auraCanvas)
  const renderer = createAuraRenderer(auraCanvas, VaporVariant)

  let armed = false
  let lockedResult = null // set once shakeTracker's round completes; read every recorded frame
  const shakeTracker = createShakeTracker({
    onRoundComplete: (result) => {
      lockedResult = result
    },
  })
  let lastDetectionTime = 0
  let activeRecording = null

  const releaseBtn = document.createElement('button')
  releaseBtn.type = 'button'
  releaseBtn.className = 'release-btn'
  releaseBtn.textContent = videoCaptureReady ? 'Release your aura' : 'Capture unavailable'
  releaseBtn.disabled = !videoCaptureReady
  root.appendChild(releaseBtn)

  function releaseAura() {
    if (armed || !videoCaptureReady) return
    armed = true
    lockedResult = null
    lastDetectionTime = 0 // don't diff against a stale idle-era timestamp
    shakeTracker.reset()
    renderer.setArmed(true)
    releaseBtn.disabled = true
    releaseBtn.classList.add('recording')
    releaseBtn.textContent = 'Capturing…'

    activeRecording = startVideoCapture({
      width: auraCanvas.width,
      height: auraCanvas.height,
      videoEl,
      auraCanvas,
      getScoreResult: () => lockedResult,
    })
    activeRecording.done
      .then((blob) => onCapture(blob))
      .catch((err) => console.error('[videoCapture] failed:', err))
      .finally(() => {
        armed = false
        renderer.setArmed(false)
        releaseBtn.disabled = false
        releaseBtn.classList.remove('recording')
        releaseBtn.textContent = 'Release your aura'
        activeRecording = null
      })
  }

  releaseBtn.addEventListener('click', releaseAura)

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
  renderer.setArmed(false) // begin idle -- no particles until "Release your aura" is tapped

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

      // shakeTracker only runs once armed -- while idle, motion is tracked
      // for rendering (so the aura anchor is warm) but not scored.
      if (armed) {
        // Detections arrive at MediaPipe's throttled rate (~15Hz), not per rAF
        // frame, so the shake tracker needs its own dt computed from wall-clock
        // time between calls (mirroring AuraRenderer.js's own lastTime/dt).
        const now = performance.now()
        const dt = lastDetectionTime ? Math.min((now - lastDetectionTime) / 1000, 0.2) : 0
        lastDetectionTime = now
        shakeTracker.update(dt, anchor)
      }
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
      activeRecording?.stop() // cancel an in-flight recording rather than leak its rAF loop + open stream
      renderer.stop()
      shakeTracker.reset()
      videoEl.style.display = 'none'
      auraCanvas.remove()
      debugCanvas?.remove()
      releaseBtn.remove()
    },
  }
}
