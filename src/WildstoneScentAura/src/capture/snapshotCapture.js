import { compositeFrame } from './compositeFrame.js'

// Composites the visible frame (video, if there is one, plus the aura
// canvas) into a single flat image via canvas.toBlob -- the guaranteed,
// always-shipped capture path (see Planning/CONTEXT.md capture architecture
// decision). Shares its per-frame compositing with videoCapture.js via
// compositeFrame.js so a single frame of a recording and a snapshot always
// look identical.
export function captureSnapshot({ width, height, videoEl, auraCanvas }) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  compositeFrame(ctx, { width, height, videoEl, auraCanvas })

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}
