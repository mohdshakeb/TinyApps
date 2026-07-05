export const States = Object.freeze({
  SPLASH: 'SPLASH',
  PERMISSION_REQUEST: 'PERMISSION_REQUEST',
  CAMERA_INITIALIZING: 'CAMERA_INITIALIZING',
  LIVE_AURA: 'LIVE_AURA',
  CAPTURE_PREVIEW: 'CAPTURE_PREVIEW',
  SHARE: 'SHARE',
  FALLBACK_TOUCH_CANVAS: 'FALLBACK_TOUCH_CANVAS',
})

// CAPTURE_PREVIEW/SHARE are reached from either LIVE_AURA or
// FALLBACK_TOUCH_CANVAS (Session 5 reuses one capture/share flow for both
// branches). RETRY and DONE need to hand the user back to whichever branch
// they captured from, not always LIVE_AURA -- otherwise a camera-denied user
// who captures from the fallback screen gets bounced into a state that
// needs a camera they don't have. RETURN_TO_ORIGIN is a sentinel the lookup
// table can point at instead of a fixed state.
const RETURN_TO_ORIGIN = Symbol('RETURN_TO_ORIGIN')
const CAPTURE_ORIGINS = new Set([States.LIVE_AURA, States.FALLBACK_TOUCH_CANVAS])

const TRANSITIONS = {
  [States.SPLASH]: {
    START: States.PERMISSION_REQUEST,
  },
  [States.PERMISSION_REQUEST]: {
    GRANTED: States.CAMERA_INITIALIZING,
    DENIED: States.FALLBACK_TOUCH_CANVAS,
  },
  [States.CAMERA_INITIALIZING]: {
    READY: States.LIVE_AURA,
    FAILED: States.FALLBACK_TOUCH_CANVAS,
  },
  [States.LIVE_AURA]: {
    CAPTURE: States.CAPTURE_PREVIEW,
    CAMERA_LOST: States.FALLBACK_TOUCH_CANVAS,
  },
  [States.CAPTURE_PREVIEW]: {
    RETRY: RETURN_TO_ORIGIN,
    CONFIRM: States.SHARE,
  },
  [States.SHARE]: {
    DONE: RETURN_TO_ORIGIN,
  },
  [States.FALLBACK_TOUCH_CANVAS]: {
    CAPTURE: States.CAPTURE_PREVIEW,
  },
}

export function createStateMachine(initial = States.SPLASH, { onTransition } = {}) {
  let current = initial
  let captureOrigin = States.LIVE_AURA

  function getState() {
    return current
  }

  function send(event) {
    const mapped = TRANSITIONS[current]?.[event]
    if (!mapped) return current

    const from = current
    if (event === 'CAPTURE' && CAPTURE_ORIGINS.has(from)) {
      captureOrigin = from
    }

    const next = mapped === RETURN_TO_ORIGIN ? captureOrigin : mapped
    current = next
    onTransition?.({ from, to: next, event })
    return current
  }

  return { getState, send }
}
