// BountyNet — detect failed CI on GitHub PRs and offer bounty creation

function detectFailedChecks() {
  const checks = document.querySelectorAll('.merge-status-item')
  const failed = []
  
  checks.forEach(el => {
    if (el.querySelector('.octicon-x')) {
      const name = el.querySelector('.status-heading')?.textContent?.trim()
      if (name) failed.push(name)
    }
  })

  if (failed.length > 0) {
    injectBountyPrompt(failed)
  }
}

function injectBountyPrompt(failedChecks) {
  const existing = document.getElementById('bountynet-prompt')
  if (existing) return

  const container = document.querySelector('.merge-message')
  if (!container) return

  const div = document.createElement('div')
  div.id = 'bountynet-prompt'
  div.innerHTML = `
    <div class="bountynet-banner">
      <strong>BountyNet</strong> — ${failedChecks.length} check${failedChecks.length > 1 ? 's' : ''} failing
      <button id="bountynet-create">Stake bounty</button>
    </div>
  `
  container.prepend(div)

  document.getElementById('bountynet-create')?.addEventListener('click', () => {
    // TODO: connect to wallet and create bounty
    console.log('[BountyNet] creating bounty for:', failedChecks)
  })
}

// Run on page load and on navigation (GitHub is SPA)
detectFailedChecks()
new MutationObserver(detectFailedChecks).observe(document.body, { childList: true, subtree: true })
