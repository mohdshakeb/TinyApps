// Exact math for mapping a point in a <video>'s native pixel space into its
// rendered position when displayed with CSS `object-fit: cover`. Session 3's
// debug overlay used an approximation (independent x/y scale, no crop
// offset); this accounts for the uniform scale + centered crop cover actually
// applies, since the aura anchor needs to track the face precisely, not just
// approximately.

export function coverScaleFor(videoWidth, videoHeight, displayWidth, displayHeight) {
  return Math.max(displayWidth / videoWidth, displayHeight / videoHeight)
}

export function mapCoverPoint(videoX, videoY, videoWidth, videoHeight, displayWidth, displayHeight) {
  const coverScale = coverScaleFor(videoWidth, videoHeight, displayWidth, displayHeight)
  const offsetX = (displayWidth - videoWidth * coverScale) / 2
  const offsetY = (displayHeight - videoHeight * coverScale) / 2
  return {
    x: videoX * coverScale + offsetX,
    y: videoY * coverScale + offsetY,
    coverScale,
  }
}

// `#camera-feed` is mirrored via CSS `transform: scaleX(-1)` so the preview
// feels like a mirror; anything drawn in an un-mirrored overlay canvas needs
// this same flip to line up with what the user actually sees.
export function mirrorX(x, displayWidth) {
  return displayWidth - x
}
