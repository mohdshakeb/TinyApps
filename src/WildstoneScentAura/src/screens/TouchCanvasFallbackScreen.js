export function mountTouchCanvasFallbackScreen(root) {
  const el = document.createElement('div')
  el.className = 'screen screen-fallback'
  el.innerHTML = `
    <h2 class="fallback-title">Camera unavailable</h2>
    <p class="fallback-subtitle">Drag your finger across the screen to shape the aura instead.</p>
  `
  root.appendChild(el)

  return {
    unmount() {
      el.remove()
    },
  }
}
