const SHARE_TITLE = 'Wildstone Edge Aura'
const SHARE_TEXT = '#IntensifyYourGame'

// Native Web Share sheet where supported (most mobile browsers, the actual
// demo target); falls back to an instant download link everywhere else
// (desktop, or a mobile browser without file-share support). Per the PRD:
// "A native Web Share sheet or instant download link".
export async function shareOrDownload(blob, filename = 'wildstone-aura.png') {
  const file = new File([blob], filename, { type: blob.type })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: SHARE_TITLE, text: SHARE_TEXT })
      return { method: 'share' }
    } catch (err) {
      if (err.name === 'AbortError') return { method: 'cancelled' }
      // Real share failure (not a user cancel) -- fall through to download.
    }
  }

  downloadBlob(blob, filename)
  return { method: 'download' }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
