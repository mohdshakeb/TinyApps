const BUCKET_COPY = {
  'too-slow': 'Too gentle — put more energy into it',
  'too-fast': 'A bit erratic — find a steady rhythm',
  perfect: 'Perfect release!',
}

export function mountShakeResultsScreen(root, { result, onRetry }) {
  const { score, bucket } = result

  const el = document.createElement('div')
  el.className = 'screen screen-shake-results'
  el.innerHTML = `
    <div class="shake-results-score">${Math.round(score)}</div>
    <p class="shake-results-bucket">${BUCKET_COPY[bucket] ?? ''}</p>
    <button type="button" class="btn-primary" data-action="retry">Try Again</button>
  `
  el.querySelector('[data-action="retry"]').addEventListener('click', onRetry)
  root.appendChild(el)

  return {
    unmount() {
      el.remove()
    },
  }
}
