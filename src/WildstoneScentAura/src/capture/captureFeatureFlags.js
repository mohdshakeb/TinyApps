// The plan's Session 1 (a real iPhone MediaRecorder spike) still hasn't run
// -- no iPhone has been available. Enabling this now trades that off
// deliberately: `videoCapture.js` is being validated first against desktop
// Safari (real WebKit, catches API-level bugs) as an interim check, not a
// substitute for iOS confirmation -- desktop and mobile Safari have
// historically diverged on exactly this canvas-captureStream +
// MediaRecorder combination (codec support, memory/thermal pressure,
// hardware encode paths). Treat this flag as "desktop-Safari-passing", not
// "demo-safe", until a real iPhone test confirms it -- see
// Planning/CONTEXT.md and PROGRESS.md for the tracked result.
export const ENABLE_VIDEO_CAPTURE = true
