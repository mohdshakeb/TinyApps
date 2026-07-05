import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createStateMachine, States } from '../../src/state/appStateMachine.js'

test('starts in SPLASH', () => {
  const machine = createStateMachine()
  assert.equal(machine.getState(), States.SPLASH)
})

test('happy path: SPLASH -> PERMISSION_REQUEST -> CAMERA_INITIALIZING -> LIVE_AURA', () => {
  const machine = createStateMachine()
  machine.send('START')
  assert.equal(machine.getState(), States.PERMISSION_REQUEST)
  machine.send('GRANTED')
  assert.equal(machine.getState(), States.CAMERA_INITIALIZING)
  machine.send('READY')
  assert.equal(machine.getState(), States.LIVE_AURA)
})

test('permission denied falls back to Touch Canvas', () => {
  const machine = createStateMachine()
  machine.send('START')
  machine.send('DENIED')
  assert.equal(machine.getState(), States.FALLBACK_TOUCH_CANVAS)
})

test('tracker init failure falls back to Touch Canvas', () => {
  const machine = createStateMachine()
  machine.send('START')
  machine.send('GRANTED')
  machine.send('FAILED')
  assert.equal(machine.getState(), States.FALLBACK_TOUCH_CANVAS)
})

test('camera dying mid-session falls back to Touch Canvas', () => {
  const machine = createStateMachine()
  machine.send('START')
  machine.send('GRANTED')
  machine.send('READY')
  machine.send('CAMERA_LOST')
  assert.equal(machine.getState(), States.FALLBACK_TOUCH_CANVAS)
})

test('capture/share loop: LIVE_AURA -> CAPTURE_PREVIEW -> SHARE -> LIVE_AURA, and retry', () => {
  const machine = createStateMachine(States.LIVE_AURA)
  machine.send('CAPTURE')
  assert.equal(machine.getState(), States.CAPTURE_PREVIEW)
  machine.send('RETRY')
  assert.equal(machine.getState(), States.LIVE_AURA)
  machine.send('CAPTURE')
  machine.send('CONFIRM')
  assert.equal(machine.getState(), States.SHARE)
  machine.send('DONE')
  assert.equal(machine.getState(), States.LIVE_AURA)
})

test('Touch Canvas fallback reuses the capture/share flow', () => {
  const machine = createStateMachine(States.FALLBACK_TOUCH_CANVAS)
  machine.send('CAPTURE')
  assert.equal(machine.getState(), States.CAPTURE_PREVIEW)
})

test('retry from a fallback-originated capture returns to the fallback screen, not LIVE_AURA', () => {
  const machine = createStateMachine(States.FALLBACK_TOUCH_CANVAS)
  machine.send('CAPTURE')
  machine.send('RETRY')
  assert.equal(machine.getState(), States.FALLBACK_TOUCH_CANVAS)
})

test('sharing a fallback-originated capture returns to the fallback screen after DONE', () => {
  const machine = createStateMachine(States.FALLBACK_TOUCH_CANVAS)
  machine.send('CAPTURE')
  machine.send('CONFIRM')
  assert.equal(machine.getState(), States.SHARE)
  machine.send('DONE')
  assert.equal(machine.getState(), States.FALLBACK_TOUCH_CANVAS)
})

test('unknown events are a no-op', () => {
  const machine = createStateMachine()
  const result = machine.send('NOT_A_REAL_EVENT')
  assert.equal(result, States.SPLASH)
  assert.equal(machine.getState(), States.SPLASH)
})

test('onTransition fires with from/to/event', () => {
  const seen = []
  const machine = createStateMachine(States.SPLASH, {
    onTransition: (t) => seen.push(t),
  })
  machine.send('START')
  assert.deepEqual(seen, [{ from: States.SPLASH, to: States.PERMISSION_REQUEST, event: 'START' }])
})
