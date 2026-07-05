export function mountCapturePreviewScreen(root, { mediaUrl, blob, onRetry, onConfirm }) {
  const isVideo = blob.type.startsWith('video/')

  const el = document.createElement('div')
  el.className = 'screen-preview'
  el.innerHTML = `
    ${
      isVideo
        ? `<video class="preview-image" src="${mediaUrl}" autoplay loop muted playsinline></video>`
        : `<img class="preview-image" src="${mediaUrl}" alt="Captured aura snapshot" />`
    }
    <div class="preview-actions">
      <button type="button" class="btn-secondary" data-action="retry">Retry</button>
      <button type="button" class="btn-primary" data-action="confirm">${isVideo ? 'Use Video' : 'Use Photo'}</button>
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
