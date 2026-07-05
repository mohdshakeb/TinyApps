const LABEL = '#IntensifyYourGame'
const SUBLABEL = 'WILDSTONE EDGE'

// Bottom-left per the PRD's "top right or bottom left" watermark placement --
// bottom-left keeps clear of a front camera notch/punch-hole that a top
// placement risks colliding with on an unknown client device.
export function drawBrandOverlay(ctx, width, height) {
  const pad = Math.round(width * 0.045)
  const labelSize = Math.max(14, Math.round(width * 0.032))
  const subSize = Math.max(10, Math.round(width * 0.02))

  ctx.save()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
  ctx.shadowBlur = 6

  ctx.globalAlpha = 0.9
  ctx.fillStyle = '#4fc3ff'
  ctx.font = `600 ${subSize}px -apple-system, system-ui, sans-serif`
  ctx.fillText(SUBLABEL, pad, height - pad)

  ctx.globalAlpha = 0.85
  ctx.fillStyle = '#e8e8ff'
  ctx.font = `600 ${labelSize}px -apple-system, system-ui, sans-serif`
  ctx.fillText(LABEL, pad, height - pad - subSize - 6)

  ctx.restore()
}
