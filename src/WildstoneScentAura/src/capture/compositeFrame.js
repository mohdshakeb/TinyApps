import { coverDrawParams } from '../utils/coverCrop.js'
import { drawBrandOverlay } from '../ui/BrandOverlay.js'

const BACKGROUND = '#0a0a0f'

// Draws one frame of the live view (mirrored, cover-cropped video, if any,
// plus the aura canvas, plus the brand watermark) onto `ctx` -- shared by
// snapshotCapture.js (draws it once) and videoCapture.js (draws it on every
// rAF tick while recording), so a still and a video frame always match.
// `auraCanvas`'s contents are already in mirrored/display space
// (faceAnchor.js mirrors anchor.x up front), so only the video layer needs
// the mirror + cover-crop applied here to match what the user sees on screen.
export function compositeFrame(ctx, { width, height, videoEl, auraCanvas }) {
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
}
