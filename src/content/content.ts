interface Stats {
  errors: number
  performance: number
  network: number
  paint: number
}

interface SpectraEvent {
  type: string
  message: string
  timestamp: number
  details?: Record<string, unknown>
}

class SpectraContent {
  private stats: Stats = { errors: 0, performance: 0, network: 0, paint: 0 }
  private events: SpectraEvent[] = []
  private settings = { errors: true, performance: true, network: true }
  private scriptInjected = false

  constructor() {
    this.loadSettings()
    this.injectScript()
    this.setupMessageListener()
    this.setupPerformanceObserver()
    console.log('[Spectra Content] Initialized')
  }

  private async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['spectra_settings'])
      const settings = result.spectra_settings as { errors: boolean; performance: boolean; network: boolean } | undefined
      if (settings) {
        this.settings = settings
      }
    } catch (e) {
      console.error('[Spectra] Failed to load settings', e)
    }
  }

  private injectScript() {
    if (this.scriptInjected) return

    const script = document.createElement('script')
    script.src = chrome.runtime.getURL('injected.js')
    script.onload = () => {
      script.remove()
      this.scriptInjected = true
    }
    ;(document.head || document.documentElement).appendChild(script)

    window.addEventListener('message', (event) => {
      if (event.source !== window || !event.data.type?.startsWith('SPECTRA_')) return

      if (event.data.type === 'SPECTRA_DATA') {
        this.handleData(event.data.payload)
      }
    })
  }

  private handleData(data: SpectraEvent) {
    if (!this.shouldTrack(data.type)) return

    this.events.push(data)
    this.updateStats(data.type)
  }

  private shouldTrack(type: string): boolean {
    if (type === 'error' || type === 'unhandledrejection') return this.settings.errors
    if (type === 'navigation' || type === 'resource') return this.settings.network
    if (type === 'paint') return this.settings.performance
    return true
  }

  private updateStats(type: string) {
    switch (type) {
      case 'error':
      case 'unhandledrejection':
        this.stats.errors++
        break
      case 'navigation':
      case 'resource':
        this.stats.network++
        break
      case 'paint':
        this.stats.paint++
        break
      default:
        this.stats.performance++
    }
  }

  private setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_STATS') {
        sendResponse({
          stats: this.stats,
          events: this.events.slice(-50)
        })
      }

      if (message.type === 'CLEAR_STATS') {
        this.stats = { errors: 0, performance: 0, network: 0, paint: 0 }
        this.events = []
        sendResponse({ success: true })
      }

      return true
    })
  }

  private setupPerformanceObserver() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        let type = ''
        if (entry.entryType === 'navigation') type = 'navigation'
        else if (entry.entryType === 'resource') type = 'resource'
        else if (entry.entryType === 'paint') type = 'paint'

        if (type && this.shouldTrack(type)) {
          const eventData: SpectraEvent = {
            type,
            message: entry.name || type,
            timestamp: Date.now(),
            details: { duration: entry.duration, startTime: entry.startTime }
          }
          this.handleData(eventData)
        }
      }
    })

    try {
      observer.observe({ entryTypes: ['navigation', 'resource', 'paint'] })
    } catch (e) {
      console.warn('[Spectra] PerformanceObserver not fully supported', e)
    }
  }
}

new SpectraContent()
