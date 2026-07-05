const MAX_LINES = 50

export function initDebugOverlay() {
  const params = new URLSearchParams(location.search)
  if (params.get('debug') !== '1') return

  const panel = document.createElement('div')
  panel.id = 'debug-overlay'
  Object.assign(panel.style, {
    position: 'fixed',
    top: 'auto',
    left: '0',
    right: '0',
    bottom: '0',
    width: '100%',
    maxHeight: '40vh',
    overflowY: 'auto',
    background: 'rgba(10, 10, 15, 0.9)',
    color: '#9fffb0',
    font: '11px/1.4 ui-monospace, monospace',
    padding: '8px',
    paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
    zIndex: '99999',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    borderTop: '1px solid rgba(159, 255, 176, 0.3)',
  })
  document.body.appendChild(panel)

  function write(text, color) {
    const line = document.createElement('div')
    line.textContent = text
    if (color) line.style.color = color
    panel.appendChild(line)
    while (panel.childNodes.length > MAX_LINES) panel.removeChild(panel.firstChild)
    panel.scrollTop = panel.scrollHeight
  }

  function stringify(args) {
    return args
      .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ')
  }

  const original = { log: console.log, warn: console.warn, error: console.error }
  console.log = (...args) => {
    write(stringify(args))
    original.log(...args)
  }
  console.warn = (...args) => {
    write(stringify(args), '#ffd479')
    original.warn(...args)
  }
  console.error = (...args) => {
    write(stringify(args), '#ff8a8a')
    original.error(...args)
  }

  window.addEventListener('error', (e) => {
    write(`[window.error] ${e.message} (${e.filename}:${e.lineno})`, '#ff8a8a')
  })
  window.addEventListener('unhandledrejection', (e) => {
    write(`[unhandledrejection] ${e.reason}`, '#ff8a8a')
  })

  write(`[debugOverlay] active — ua: ${navigator.userAgent}`)
}
