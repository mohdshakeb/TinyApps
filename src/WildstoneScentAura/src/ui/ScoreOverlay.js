const BUCKET_COPY = {
  'too-slow': 'Too gentle — put more energy into it',
  'too-fast': 'A bit erratic — find a steady rhythm',
  perfect: 'Perfect release!',
}

// Burned directly into the captured video from the moment a shake round
// starts (Session 10: previously `result` was null until the round locked,
// so the score only appeared for the last fraction of the clip). `result` is
// null until `shakeTracker.getScore()` sees the first reversal, so this draws
// nothing before real shake motion begins; the score number then renders and
// updates live every frame, while the verdict/bucket line waits for
// `result.locked` so it doesn't flash a premature verdict mid-shake.
export function drawScoreOverlay(ctx, width, height, result) {
  if (!result) return
  const { score, bucket, locked } = result

  const bandHeight = height * 0.16

  ctx.save()
  ctx.fillStyle = 'rgba(10, 10, 15, 0.55)'
  ctx.fillRect(0, 0, width, bandHeight)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 ${Math.round(height * 0.09)}px -apple-system, system-ui, sans-serif`
  ctx.fillText(String(Math.round(score)), width / 2, bandHeight * 0.62)

  if (locked) {
    ctx.font = `500 ${Math.round(height * 0.024)}px -apple-system, system-ui, sans-serif`
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.fillText(BUCKET_COPY[bucket] ?? '', width / 2, bandHeight * 0.92)
  }
  ctx.restore()
}
