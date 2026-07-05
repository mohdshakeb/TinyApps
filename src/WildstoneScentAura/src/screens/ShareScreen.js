import { shareOrDownload } from '../share/shareSheet.js'

export function mountShareScreen(root, { imageUrl, blob, onDone }) {
  const el = document.createElement('div')
  el.className = 'screen-preview screen-share'
  el.innerHTML = `
    <img class="preview-image" src="${imageUrl}" alt="Your Wildstone Edge aura" />
    <div class="preview-actions">
      <button type="button" class="btn-primary" data-action="share">Share</button>
      <button type="button" class="btn-secondary" data-action="done">Done</button>
    </div>
  `

  const shareBtn = el.querySelector('[data-action="share"]')
  shareBtn.addEventListener('click', async () => {
    shareBtn.disabled = true
    try {
      await shareOrDownload(blob)
    } finally {
      shareBtn.disabled = false
    }
  })

  el.querySelector('[data-action="done"]').addEventListener('click', onDone)
  root.appendChild(el)

  return {
    unmount() {
      el.remove()
    },
  }
}
