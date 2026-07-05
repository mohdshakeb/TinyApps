const CONSTRAINTS = {
  video: {
    facingMode: 'user',
    width: { ideal: 640 },
    height: { ideal: 480 },
  },
  audio: false,
}

export async function startCameraStream(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS)
  videoEl.srcObject = stream
  await new Promise((resolve) => {
    videoEl.onloadedmetadata = () => resolve()
  })
  await videoEl.play()
  return stream
}
