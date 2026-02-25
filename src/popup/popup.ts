interface Stats {
  errors: number
  performance: number
  network: number
  paint: number
}

interface EventItem {
  type: string
  message: string
  timestamp: number
  details?: Record<string, unknown>
}

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('statusDot') as HTMLElement
  const statusText = document.getElementById('statusText') as HTMLElement
  const errorCount = document.getElementById('errorCount') as HTMLElement
  const perfCount = document.getElementById('perfCount') as HTMLElement
  const networkCount = document.getElementById('networkCount') as HTMLElement
  const paintCount = document.getElementById('paintCount') as HTMLElement
  const eventList = document.getElementById('eventList') as HTMLElement
  const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement
  const dashboardBtn = document.getElementById('dashboardBtn') as HTMLButtonElement
  const toggleErrors = document.getElementById('toggleErrors') as HTMLInputElement
  const togglePerf = document.getElementById('togglePerf') as HTMLInputElement
  const toggleNetwork = document.getElementById('toggleNetwork') as HTMLInputElement

  let stats: Stats = { errors: 0, performance: 0, network: 0, paint: 0 }
  let events: EventItem[] = []
  let isEnabled = true

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const currentTab = tabs[0]

  if (!currentTab?.id) {
    setStatus(false)
    return
  }

  function setStatus(active: boolean) {
    isEnabled = active
    if (active) {
      statusDot.classList.remove('disabled')
      statusText.textContent = 'Active'
    } else {
      statusDot.classList.add('disabled')
      statusText.textContent = 'Inactive'
    }
  }

  function updateStats(newStats: Stats) {
    stats = newStats
    errorCount.textContent = String(stats.errors)
    perfCount.textContent = String(stats.performance)
    networkCount.textContent = String(stats.network)
    paintCount.textContent = String(stats.paint)
  }

  function renderEvents() {
    if (events.length === 0) {
      eventList.innerHTML = '<div class="empty-state">No events yet</div>'
      return
    }

    const recentEvents = events.slice(-10).reverse()
    eventList.innerHTML = recentEvents
      .map(
        (event) => `
        <div class="event-item">
          <div class="event-icon">${getEventIcon(event.type)}</div>
          <div class="event-content">
            <div class="event-message">${escapeHtml(event.message)}</div>
            <div class="event-meta">
              <span>${event.type}</span>
              <span>•</span>
              <span>${formatTime(event.timestamp)}</span>
            </div>
          </div>
        </div>
      `
      )
      .join('')
  }

  function getEventIcon(type: string): string {
    switch (type) {
      case 'error':
      case 'unhandledrejection':
        return '⚠️'
      case 'navigation':
      case 'resource':
      case 'paint':
        return '📊'
      default:
        return '🌐'
    }
  }

  function escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString()
  }

  async function loadSettings() {
    const result = await chrome.storage.local.get(['spectra_settings'])
    const settings = (result.spectra_settings as { errors: boolean; performance: boolean; network: boolean } | undefined) || {
      errors: true,
      performance: true,
      network: true
    }

    toggleErrors.checked = settings.errors
    togglePerf.checked = settings.performance
    toggleNetwork.checked = settings.network
  }

  async function saveSettings() {
    await chrome.storage.local.set({
      spectra_settings: {
        errors: toggleErrors.checked,
        performance: togglePerf.checked,
        network: toggleNetwork.checked
      }
    })
  }

  async function requestData() {
    try {
      const response = await chrome.tabs.sendMessage(currentTab.id!, {
        type: 'GET_STATS'
      })
      if (response) {
        updateStats(response.stats)
        events = response.events || []
        renderEvents()
      }
    } catch {
      setStatus(false)
    }
  }

  clearBtn.addEventListener('click', async () => {
    await chrome.tabs.sendMessage(currentTab.id!, { type: 'CLEAR_STATS' })
    updateStats({ errors: 0, performance: 0, network: 0, paint: 0 })
    events = []
    renderEvents()
  })

  dashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000' })
  })

  toggleErrors.addEventListener('change', saveSettings)
  togglePerf.addEventListener('change', saveSettings)
  toggleNetwork.addEventListener('change', saveSettings)

  await loadSettings()
  await requestData()

  setInterval(() => requestData(), 1000)
})
