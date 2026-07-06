// Detects a "shake round" from the anchor's x-position stream and scores it
// on amplitude + tempo-consistency (not raw speed) once the round ends.
// Game/product logic, not rendering -- kept separate from AuraRenderer.js's
// generic motion-energy signal, and only ever driven during LIVE_AURA.
//
// Reversal detection is a classic zig-zag: track a running extreme in the
// current direction from a reference point, and confirm a reversal once the
// signal retraces AMPLITUDE_THRESHOLD from that extreme. All constants below
// are starting estimates -- expect these need tuning once seen on a real
// device, same as this project's other tuned constants (e.g. AuraRenderer.js
// SMOOTHING, EdgeVariant's former RING_RADIUS_FRACTION).

const AMPLITUDE_THRESHOLD = 0.06 // normalized 0-1 display-space x-distance to confirm a reversal
const MOVEMENT_EPSILON = 0.004 // sub-threshold motion still counts as "not idle"
const STILLNESS_MS = 600 // no movement for this long ends the round
// Session 9: the round now needs to fit inside a 10s captured clip instead
// of a standalone results screen, so this extends from the original 4s to
// just under that -- STILLNESS_MS is still what normally ends a round (a
// deliberate pause reads as "I'm done"); this is only the safety cap for a
// shake that never stops on its own.
const MAX_ROUND_MS = 9500

const AMP_MIN = 0.03 // barely-there swing
const AMP_TARGET = 0.12 // a confident head-turn width
const TEMPO_MIN = 1.5 // reversals/sec, lower edge of the "good" band
const TEMPO_MAX = 4 // reversals/sec, upper edge of the "good" band

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function tempoRateNorm(reversalsPerSec) {
  if (reversalsPerSec < TEMPO_MIN) return clamp(1 - (TEMPO_MIN - reversalsPerSec) / TEMPO_MIN, 0, 1)
  if (reversalsPerSec > TEMPO_MAX) return clamp(1 - (reversalsPerSec - TEMPO_MAX) / TEMPO_MIN, 0, 1)
  return 1
}

function scoreRound(events, durationSec) {
  const roundDurationMs = durationSec * 1000

  if (events.length < 2) {
    return {
      score: 0,
      bucket: 'too-slow',
      meanAmplitude: events[0]?.amplitude ?? 0,
      reversalCount: events.length,
      roundDurationMs,
    }
  }

  const meanAmplitude = events.reduce((sum, e) => sum + e.amplitude, 0) / events.length
  const ampNorm = clamp((meanAmplitude - AMP_MIN) / (AMP_TARGET - AMP_MIN), 0, 1)

  const intervals = []
  for (let i = 1; i < events.length; i++) intervals.push(events[i].t - events[i - 1].t)
  const meanInterval = intervals.reduce((sum, v) => sum + v, 0) / intervals.length
  const variance = intervals.reduce((sum, v) => sum + (v - meanInterval) ** 2, 0) / intervals.length
  const stdDevInterval = Math.sqrt(variance)
  const consistency = meanInterval > 0 ? clamp(1 - stdDevInterval / meanInterval, 0, 1) : 0

  const reversalsPerSec = durationSec > 0 ? events.length / durationSec : 0
  const tempoNorm = tempoRateNorm(reversalsPerSec)

  const score = clamp(100 * (0.45 * ampNorm + 0.35 * consistency + 0.2 * tempoNorm), 0, 100)

  // Amplitude checked first: a barely-moving user can't be "too fast" no
  // matter how jittery. "Too fast" here means erratic/inconsistent rhythm,
  // not literal high velocity.
  const bucket = ampNorm < 0.35 ? 'too-slow' : consistency < 0.5 ? 'too-fast' : 'perfect'

  return { score, bucket, meanAmplitude, reversalCount: events.length, roundDurationMs }
}

export function createShakeTracker() {
  let elapsed = 0
  let prevX = null
  let referenceX = null
  let extremeX = null
  let direction = 0 // 0 = idle/undetermined, 1 = tracking a rightward extreme, -1 = leftward
  let roundActive = false
  let roundStartTime = 0
  let lastMovementTime = 0
  let reversalEvents = []
  // Session 9: a captured clip scores exactly one round. Once that round
  // completes, `update` becomes a no-op until `reset()` -- otherwise a user
  // pausing (round completes) then shaking again before the clip ends would
  // silently start a second round and overwrite the first score, which
  // contradicts "the first completed shake is what gets scored."
  let locked = false
  let lockedResult = null

  function startRound() {
    roundActive = true
    roundStartTime = elapsed
    lastMovementTime = elapsed
    reversalEvents = []
  }

  function recordReversal(amplitude) {
    reversalEvents.push({ t: elapsed, amplitude: Math.abs(amplitude) })
    lastMovementTime = elapsed
  }

  function processSample(x) {
    if (direction === 0) {
      const delta = x - referenceX
      if (delta >= AMPLITUDE_THRESHOLD) {
        direction = 1
        extremeX = x
        startRound()
      } else if (delta <= -AMPLITUDE_THRESHOLD) {
        direction = -1
        extremeX = x
        startRound()
      }
      return
    }

    if (direction === 1) {
      if (x > extremeX) extremeX = x
      if (extremeX - x >= AMPLITUDE_THRESHOLD) {
        recordReversal(extremeX - referenceX)
        referenceX = extremeX
        direction = -1
        extremeX = x
      }
    } else {
      if (x < extremeX) extremeX = x
      if (x - extremeX >= AMPLITUDE_THRESHOLD) {
        recordReversal(referenceX - extremeX)
        referenceX = extremeX
        direction = 1
        extremeX = x
      }
    }
  }

  function completeRound() {
    lockedResult = scoreRound(reversalEvents, elapsed - roundStartTime)
    roundActive = false
    direction = 0
    referenceX = prevX
    extremeX = prevX
    reversalEvents = []
    locked = true
  }

  // Pull-based, mirroring the polling model videoCapture.js already uses for
  // `getScoreResult` -- called every recorded frame so the score burned into
  // the video can climb live from the moment the shake begins, not only
  // appear once the round locks (Session 10: the score used to only be
  // visible for the last fraction of the 10s clip).
  function getScore() {
    if (locked) return { ...lockedResult, locked: true }
    if (roundActive) return { ...scoreRound(reversalEvents, elapsed - roundStartTime), locked: false }
    return null
  }

  function update(dt, anchor) {
    if (locked) return

    elapsed += dt

    if (anchor && anchor.confidence > 0.05) {
      const x = anchor.x
      if (prevX === null) {
        prevX = x
        referenceX = x
        extremeX = x
      } else {
        if (Math.abs(x - prevX) > MOVEMENT_EPSILON) lastMovementTime = elapsed
        prevX = x
        processSample(x)
      }
    }

    if (roundActive) {
      const idleFor = elapsed - lastMovementTime
      const durationSoFar = elapsed - roundStartTime
      if (idleFor >= STILLNESS_MS / 1000 || durationSoFar >= MAX_ROUND_MS / 1000) {
        completeRound()
      }
    }
  }

  function reset() {
    elapsed = 0
    prevX = null
    referenceX = null
    extremeX = null
    direction = 0
    roundActive = false
    roundStartTime = 0
    lastMovementTime = 0
    reversalEvents = []
    locked = false
    lockedResult = null
  }

  return { update, reset, getScore }
}
