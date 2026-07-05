import { startCameraStream } from './camera/cameraStream.js'
import { initFaceTracker, startDetectionLoop } from './tracking/faceTracker.js'

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
    startDetectionLoop(videoEl, (detections) => {
      if (detections.length > 0) {
        console.log('[faceTracker] detections:', detections)
      }
    })
  } catch (err) {
    console.error('[boot] failed:', err)
    setStatus(`Error: ${err.message}`)
  }
}

boot()
