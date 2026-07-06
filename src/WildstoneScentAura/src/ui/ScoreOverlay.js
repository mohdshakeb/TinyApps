const BUCKET_COPY = {
  'too-slow': 'Too gentle — put more energy into it',
  'too-fast': 'A bit erratic — find a steady rhythm',
  perfect: 'Perfect release!',
}

// Burned directly into the captured video once a shake round locks in a
// score (Session 9: score-burned video replaces the standalone
// ShakeResultsScreen). `result` is null until the round completes, so this
// draws nothing for the first part of the clip and then holds the score for
// the remainder -- composited the same way as BrandOverlay.js, so every
// recorded frame after that point carries it identically.
export function drawScoreOverlay(ctx, width, height, result) {
  if (!result) return
  const { score, bucket } = result

  const bandHeight = height * 0.16

  ctx.save()
  ctx.fillStyle = 'rgba(10, 10, 15, 0.55)'
  ctx.fillRect(0, 0, width, bandHeight)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 ${Math.round(height * 0.09)}px -apple-system, system-ui, sans-serif`
  ctx.fillText(String(Math.round(score)), width / 2, bandHeight * 0.62)

  ctx.font = `500 ${Math.round(height * 0.024)}px -apple-system, system-ui, sans-serif`
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.fillText(BUCKET_COPY[bucket] ?? '', width / 2, bandHeight * 0.92)
  ctx.restore()
}
