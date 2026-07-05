import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'
import { tickFrame, recordDetectionLatency } from '../utils/perfMonitor.js'

const WASM_BASE_PATH = '/mediapipe/wasm'
const MODEL_PATH = '/mediapipe/models/blaze_face_short_range.tflite'
const DETECT_INTERVAL_MS = 1000 / 15

let faceDetector = null

export async function initFaceTracker() {
  const filesetResolver = await FilesetResolver.forVisionTasks(WASM_BASE_PATH)
  faceDetector = await FaceDetector.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: MODEL_PATH,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
  })
}

export function startDetectionLoop(videoEl, onDetections) {
  let lastDetectTime = 0

  function tick(now) {
    tickFrame()
    if (now - lastDetectTime >= DETECT_INTERVAL_MS) {
      lastDetectTime = now
      const detectStart = performance.now()
      const result = faceDetector.detectForVideo(videoEl, now)
      recordDetectionLatency(performance.now() - detectStart)
      onDetections(result.detections)
    }
    requestAnimationFrame(tick)
  }

  requestAnimationFrame(tick)
}
