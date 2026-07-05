import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

const WASM_BASE_PATH = '/mediapipe/wasm'
const MODEL_PATH = '/mediapipe/models/blaze_face_short_range.tflite'

let faceDetector = null
const ready = init()

async function init() {
  try {
    const filesetResolver = await FilesetResolver.forVisionTasks(WASM_BASE_PATH)
    faceDetector = await FaceDetector.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: MODEL_PATH,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
    })
    postMessage({ type: 'ready' })
  } catch (err) {
    postMessage({ type: 'init-error', message: err?.message || String(err) })
    throw err
  }
}

self.onmessage = async (event) => {
  const { type, bitmap, timestamp } = event.data

  if (type !== 'frame') return

  await ready
  const detectStart = performance.now()
  const result = faceDetector.detectForVideo(bitmap, timestamp)
  const latencyMs = performance.now() - detectStart
  bitmap.close()

  postMessage({ type: 'detections', detections: result.detections, latencyMs })
}
