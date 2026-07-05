import { startCameraStream } from './camera/cameraStream.js'
import { initFaceTracker, startDetectionLoop } from './tracking/faceTracker.js'
import { initDebugOverlay } from './utils/debugOverlay.js'

initDebugOverlay()

const videoEl = document.getElementById('camera-feed')
const statusEl = document.getElementById('status')

function setStatus(text) {
  statusEl.textContent = text
}

async function boot() {
  try {
    setStatus('Requesting camera permission…')
    await startCameraStream(videoEl)

    setStatus('Loading face tracker…')
    await initFaceTracker()

    setStatus('Tracking — check console for detections')
    let lastDetectionCount = -1
    startDetectionLoop(videoEl, (detections) => {
      if (detections.length !== lastDetectionCount) {
        lastDetectionCount = detections.length
        console.log(`[faceTracker] detection count changed: ${detections.length}`)
      }
    })
  } catch (err) {
    console.error('[boot] failed:', err)
    setStatus(`Error: ${err.message}`)
  }
}

boot()
