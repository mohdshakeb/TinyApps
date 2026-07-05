import { tickFrame, recordDetectionLatency } from '../utils/perfMonitor.js'

const DETECT_INTERVAL_MS = 1000 / 15

let worker = null
let workerReady = false
let busy = false

export function initFaceTracker() {
  return new Promise((resolve, reject) => {
    worker = new Worker(new URL('./faceTrackerWorker.js', import.meta.url))
    worker.onerror = (event) => {
      reject(new Error(event.message || 'faceTrackerWorker failed to load'))
    }
    worker.onmessage = (event) => {
      if (event.data.type === 'ready' && !workerReady) {
        workerReady = true
        resolve()
      } else if (event.data.type === 'init-error' && !workerReady) {
        reject(new Error(event.data.message))
      }
    }
  })
}

export function startDetectionLoop(videoEl, onDetections) {
  let lastDetectTime = 0
  let pendingStart = 0

  worker.onmessage = (event) => {
    if (event.data.type !== 'detections') return
    recordDetectionLatency(performance.now() - pendingStart)
    busy = false
    onDetections(event.data.detections)
  }

  async function tick(now) {
    tickFrame()
    if (!busy && now - lastDetectTime >= DETECT_INTERVAL_MS) {
      lastDetectTime = now
      busy = true
      pendingStart = performance.now()
      const bitmap = await createImageBitmap(videoEl)
      worker.postMessage({ type: 'frame', bitmap, timestamp: now }, [bitmap])
    }
    requestAnimationFrame(tick)
  }

  requestAnimationFrame(tick)
}
