export function mountPermissionScreen(root, { statusText }) {
  const el = document.createElement('div')
  el.className = 'screen screen-status'
  el.innerHTML = `
    <div class="spinner"></div>
    <p class="status-text">${statusText}</p>
  `
  root.appendChild(el)

  return {
    setText(text) {
      el.querySelector('.status-text').textContent = text
    },
    unmount() {
      el.remove()
    },
  }
}
