export const States = Object.freeze({
  SPLASH: 'SPLASH',
  PERMISSION_REQUEST: 'PERMISSION_REQUEST',
  CAMERA_INITIALIZING: 'CAMERA_INITIALIZING',
  LIVE_AURA: 'LIVE_AURA',
  CAPTURE_PREVIEW: 'CAPTURE_PREVIEW',
  SHARE: 'SHARE',
  FALLBACK_TOUCH_CANVAS: 'FALLBACK_TOUCH_CANVAS',
})

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
    RETRY: States.LIVE_AURA,
    CONFIRM: States.SHARE,
  },
  [States.SHARE]: {
    DONE: States.LIVE_AURA,
  },
  // The Touch Canvas fallback is insurance/messaging only -- it has no
  // capture entry point, so it has no outgoing transitions of its own.
  [States.FALLBACK_TOUCH_CANVAS]: {},
}

export function createStateMachine(initial = States.SPLASH, { onTransition } = {}) {
  let current = initial

  function getState() {
    return current
  }

  function send(event) {
    const next = TRANSITIONS[current]?.[event]
    if (!next) return current
    const from = current
    current = next
    onTransition?.({ from, to: next, event })
    return current
  }

  return { getState, send }
}
