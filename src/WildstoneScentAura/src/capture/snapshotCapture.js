import { coverDrawParams } from '../utils/coverCrop.js'
import { drawBrandOverlay } from '../ui/BrandOverlay.js'

const BACKGROUND = '#0a0a0f'

// Composites the visible frame (video, if there is one, plus the aura
// canvas) into a single flat image via canvas.toDataURL's underlying
// pixel buffer -- the guaranteed, always-shipped capture path (see
// Planning/CONTEXT.md capture architecture decision). `auraCanvas`'s
// contents are already in mirrored/display space (faceAnchor.js mirrors
// anchor.x up front), so only the video layer needs the mirror + cover-crop
// applied here to match what the user actually sees on screen.
export function captureSnapshot({ width, height, videoEl, auraCanvas }) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = BACKGROUND
  ctx.fillRect(0, 0, width, height)

  if (videoEl?.videoWidth) {
    ctx.save()
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
    const { sx, sy, sw, sh } = coverDrawParams(videoEl.videoWidth, videoEl.videoHeight, width, height)
    ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, width, height)
    ctx.restore()
  }

  ctx.drawImage(auraCanvas, 0, 0, width, height)
  drawBrandOverlay(ctx, width, height)

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}
