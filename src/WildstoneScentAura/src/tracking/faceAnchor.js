import { mapCoverPoint, mirrorX } from '../utils/coverCrop.js'

// A face's on-screen width, as a fraction of display width, that should
// render at the aura's neutral scale (1.0). Tuned by eye; expect this to need
// adjustment once tested on a real phone (see PROGRESS.md).
const REFERENCE_FACE_FRACTION = 0.35
const MIN_SCALE = 0.7
const MAX_SCALE = 1.6

const NEUTRAL_ANCHOR = Object.freeze({ x: 0.5, y: 0.5, scale: 1, confidence: 0 })

// Converts a MediaPipe FaceDetector result into the shared anchor shape
// `{ x, y, scale, confidence }` (x/y normalized 0-1 in display space) that
// both the camera path and the Touch Canvas fallback feed into AuraRenderer.
export function detectionsToAnchor(detections, { videoWidth, videoHeight, displayWidth, displayHeight }) {
  if (!detections?.length || !videoWidth || !videoHeight || !displayWidth || !displayHeight) {
    return NEUTRAL_ANCHOR
  }

  const box = detections[0].boundingBox
  if (!box) return NEUTRAL_ANCHOR

  const centerVideoX = box.originX + box.width / 2
  const centerVideoY = box.originY + box.height / 2

  const { x, y, coverScale } = mapCoverPoint(centerVideoX, centerVideoY, videoWidth, videoHeight, displayWidth, displayHeight)

  const faceWidthDisplay = box.width * coverScale
  const rawScale = faceWidthDisplay / displayWidth / REFERENCE_FACE_FRACTION
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale))

  return {
    x: mirrorX(x, displayWidth) / displayWidth,
    y: y / displayHeight,
    scale,
    confidence: detections[0].categories?.[0]?.score ?? 1,
  }
}
