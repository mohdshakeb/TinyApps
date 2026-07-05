export function mountLiveAuraScreen(root, { videoEl }) {
  videoEl.style.display = 'block'

  const canvas = document.createElement('canvas')
  canvas.className = 'debug-bbox-canvas'
  root.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  function resize() {
    canvas.width = videoEl.clientWidth
    canvas.height = videoEl.clientHeight
  }
  resize()
  window.addEventListener('resize', resize)

  function drawDetections(detections) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!videoEl.videoWidth) return

    // Approximate mapping from the video's native resolution to its rendered
    // (mirrored, object-fit: cover) size -- exact enough for a debug overlay;
    // Session 4's real aura anchor will need precise cover-crop math.
    const scaleX = canvas.width / videoEl.videoWidth
    const scaleY = canvas.height / videoEl.videoHeight

    ctx.strokeStyle = '#9fffb0'
    ctx.lineWidth = 2
    for (const { boundingBox: box } of detections) {
      if (!box) continue
      const x = canvas.width - (box.originX + box.width) * scaleX
      ctx.strokeRect(x, box.originY * scaleY, box.width * scaleX, box.height * scaleY)
    }
  }

  return {
    drawDetections,
    unmount() {
      window.removeEventListener('resize', resize)
      videoEl.style.display = 'none'
      canvas.remove()
    },
  }
}
