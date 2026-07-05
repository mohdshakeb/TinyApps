const FPS_REPORT_INTERVAL_MS = 1000
const LATENCY_SAMPLE_SIZE = 30

let frameCount = 0
let lastReportTime = performance.now()
let currentFps = 0
const detectionLatencies = []

export function tickFrame() {
  frameCount++
  const now = performance.now()
  if (now - lastReportTime >= FPS_REPORT_INTERVAL_MS) {
    currentFps = frameCount
    frameCount = 0
    lastReportTime = now
    reportStats()
  }
}

export function recordDetectionLatency(ms) {
  detectionLatencies.push(ms)
  if (detectionLatencies.length > LATENCY_SAMPLE_SIZE) detectionLatencies.shift()
}

function averageLatency() {
  if (!detectionLatencies.length) return 0
  const sum = detectionLatencies.reduce((a, b) => a + b, 0)
  return sum / detectionLatencies.length
}

function reportStats() {
  console.log(
    `[perf] mainThreadFps=${currentFps} avgDetectLatency=${averageLatency().toFixed(1)}ms samples=${detectionLatencies.length}`
  )
}
