import { startCameraStream } from './camera/cameraStream.js'
import { initFaceTracker, startDetectionLoop } from './tracking/faceTracker.js'
import { initDebugOverlay } from './utils/debugOverlay.js'
import { createStateMachine, States } from './state/appStateMachine.js'
import { mountSplashScreen } from './screens/SplashScreen.js'
import { mountPermissionScreen } from './screens/PermissionScreen.js'
import { mountLiveAuraScreen } from './screens/LiveAuraScreen.js'
import { mountTouchCanvasFallbackScreen } from './screens/TouchCanvasFallbackScreen.js'

initDebugOverlay()

const root = document.getElementById('app')
const videoEl = document.getElementById('camera-feed')

let currentScreen = null
function setScreen(screen) {
  currentScreen?.unmount()
  currentScreen = screen
}

const machine = createStateMachine(States.SPLASH, {
  onTransition: ({ to }) => render(to),
})

function render(state) {
  switch (state) {
    case States.SPLASH:
      setScreen(mountSplashScreen(root, { onStart: () => machine.send('START') }))
      break

    case States.PERMISSION_REQUEST:
      setScreen(mountPermissionScreen(root, { statusText: 'Requesting camera permission…' }))
      requestCamera()
      break

    case States.CAMERA_INITIALIZING:
      setScreen(mountPermissionScreen(root, { statusText: 'Loading face tracker…' }))
      loadTracker()
      break

    case States.LIVE_AURA: {
      const screen = mountLiveAuraScreen(root, { videoEl })
      setScreen(screen)
      startDetectionLoop(videoEl, (detections) => screen.drawDetections(detections))
      break
    }

    case States.FALLBACK_TOUCH_CANVAS:
      setScreen(mountTouchCanvasFallbackScreen(root))
      break
  }
}

async function requestCamera() {
  try {
    const stream = await startCameraStream(videoEl)
    stream.getVideoTracks()[0].addEventListener('ended', () => machine.send('CAMERA_LOST'))
    machine.send('GRANTED')
  } catch (err) {
    console.error('[camera] permission failed:', err)
    machine.send('DENIED')
  }
}

async function loadTracker() {
  try {
    await initFaceTracker()
    machine.send('READY')
  } catch (err) {
    console.error('[tracker] init failed:', err)
    machine.send('FAILED')
  }
}

render(machine.getState())
