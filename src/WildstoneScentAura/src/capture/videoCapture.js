import { compositeFrame } from './compositeFrame.js'

// Session 9 pivot: this is no longer a user-held long-press clip -- tapping
// "Release your aura" auto-starts a fixed 10-second scored capture (was 5s,
// per the original PRD's "looping video sequence").
const MAX_DURATION_MS = 10000
const RECORD_FPS = 30

// Safari (desktop and iOS) has never supported the 'video/webm' container
// MediaRecorder produces by default elsewhere -- it needs 'video/mp4'
// explicitly. Order matters: first supported type wins.
const MIME_CANDIDATES = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

export function isVideoCaptureSupported() {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    MIME_CANDIDATES.some((type) => MediaRecorder.isTypeSupported?.(type))
  )
}

function pickSupportedMimeType() {
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported?.(type))
}

// Starts recording a composited (video + aura + score overlay + watermark)
// canvas via canvas.captureStream() -> MediaRecorder, driven by its own rAF
// loop (independent of the aura's own renderer) so the recorded frames
// always reflect the latest composite. Returns a handle: `stop()` ends the
// recording early (used on unmount to cancel an in-flight capture, not a
// user gesture anymore -- see LiveAuraScreen.js); it also auto-stops at
// `maxDurationMs` regardless. `done` resolves with the recorded Blob once
// the recorder has actually flushed and stopped.
//
// `getScoreResult` is polled once per composited frame rather than passed as
// a single value, since the score isn't known at recording-start time -- it
// only becomes non-null partway through, once the caller's shakeTracker
// round completes (see shakeTracker.js's `locked` behavior), and every frame
// after that needs to keep drawing it.
export function startVideoCapture({
  width,
  height,
  videoEl,
  auraCanvas,
  maxDurationMs = MAX_DURATION_MS,
  getScoreResult = () => null,
}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  let rafId = requestAnimationFrame(function draw() {
    compositeFrame(ctx, { width, height, videoEl, auraCanvas, scoreResult: getScoreResult() })
    rafId = requestAnimationFrame(draw)
  })

  const stream = canvas.captureStream(RECORD_FPS)
  const mimeType = pickSupportedMimeType()
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  let stopped = false
  function teardown() {
    cancelAnimationFrame(rafId)
    stream.getTracks().forEach((track) => track.stop())
  }

  const done = new Promise((resolve, reject) => {
    recorder.onerror = (event) => {
      teardown()
      reject(event.error ?? new Error('MediaRecorder error'))
    }
    recorder.onstop = () => {
      teardown()
      resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' }))
    }
  })

  recorder.start()
  const maxTimer = setTimeout(stop, maxDurationMs)

  function stop() {
    if (stopped) return
    stopped = true
    clearTimeout(maxTimer)
    if (recorder.state !== 'inactive') recorder.stop()
  }

  return { stop, done }
}
