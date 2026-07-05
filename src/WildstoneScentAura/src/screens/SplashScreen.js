export function mountSplashScreen(root, { onStart }) {
  const el = document.createElement('div')
  el.className = 'screen screen-splash'
  el.innerHTML = `
    <h1 class="brand-title">Wildstone <span class="accent">Edge</span></h1>
    <p class="brand-subtitle">Aim your camera and let your aura ignite.</p>
    <button type="button" class="btn-primary">Start</button>
  `
  el.querySelector('button').addEventListener('click', onStart)
  root.appendChild(el)

  return {
    unmount() {
      el.remove()
    },
  }
}
