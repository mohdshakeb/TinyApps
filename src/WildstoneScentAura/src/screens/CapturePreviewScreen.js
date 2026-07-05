export function mountCapturePreviewScreen(root, { imageUrl, onRetry, onConfirm }) {
  const el = document.createElement('div')
  el.className = 'screen-preview'
  el.innerHTML = `
    <img class="preview-image" src="${imageUrl}" alt="Captured aura snapshot" />
    <div class="preview-actions">
      <button type="button" class="btn-secondary" data-action="retry">Retry</button>
      <button type="button" class="btn-primary" data-action="confirm">Use Photo</button>
    </div>
  `
  el.querySelector('[data-action="retry"]').addEventListener('click', onRetry)
  el.querySelector('[data-action="confirm"]').addEventListener('click', onConfirm)
  root.appendChild(el)

  return {
    unmount() {
      el.remove()
    },
  }
}
