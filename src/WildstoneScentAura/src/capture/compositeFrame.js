import { coverDrawParams } from '../utils/coverCrop.js'
import { drawBrandOverlay } from '../ui/BrandOverlay.js'
import { drawScoreOverlay } from '../ui/ScoreOverlay.js'

const BACKGROUND = '#0a0a0f'

// Draws one frame of the live view (mirrored, cover-cropped video, if any,
// plus the aura canvas, plus the score overlay once locked, plus the brand
// watermark) onto `ctx` -- called on every rAF tick by videoCapture.js while
// recording, so every recorded frame is built the same way.
// `auraCanvas`'s contents are already in mirrored/display space
// (faceAnchor.js mirrors anchor.x up front), so only the video layer needs
// the mirror + cover-crop applied here to match what the user sees on screen.
// `scoreResult` is null until a shake round completes (see shakeTracker.js's
// `locked` behavior) -- drawScoreOverlay no-ops until then.
export function compositeFrame(ctx, { width, height, videoEl, auraCanvas, scoreResult = null }) {
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
  drawScoreOverlay(ctx, width, height, scoreResult)
  drawBrandOverlay(ctx, width, height)
}
