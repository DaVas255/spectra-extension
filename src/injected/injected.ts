interface ErrorData {
  type: 'error' | 'unhandledrejection'
  message: string
  source?: string
  lineno?: number
  colno?: number
  stack?: string
  timestamp: number
}

interface PerformanceData {
  type: 'navigation' | 'resource' | 'paint'
  name: string
  duration: number
  startTime: number
  timestamp: number
  details?: Record<string, unknown>
}

interface NetworkData {
  url: string
  method: string
  status: number
  duration: number
  transferSize: number
  timestamp: number
}

class DataCollector {
  private buffer: Array<ErrorData | PerformanceData | NetworkData> = []

  constructor() {
    this.initErrorTracking()
    this.initPerformanceTracking()
    this.initNetworkTracking()
    console.log('[Spectra] Data collector initialized')
  }

  private log(data: ErrorData | PerformanceData | NetworkData) {
    this.buffer.push(data)
    console.log('[Spectra]', data)
  }

  private initErrorTracking() {
    window.onerror = (message, source, lineno, colno, error) => {
      const errorData: ErrorData = {
        type: 'error',
        message: String(message),
        source,
        lineno,
        colno,
        stack: error?.stack,
        timestamp: Date.now()
      }
      this.log(errorData)
      return false
    }

    window.addEventListener('unhandledrejection', (event) => {
      const errorData: ErrorData = {
        type: 'unhandledrejection',
        message: String(event.reason),
        stack: event.reason?.stack,
        timestamp: Date.now()
      }
      this.log(errorData)
      event.preventDefault()
    })
  }

  private initPerformanceTracking() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        let type: 'navigation' | 'resource' | 'paint' = 'resource'
        if (entry.entryType === 'navigation') type = 'navigation'
        else if (entry.entryType === 'paint') type = 'paint'

        const perfData: PerformanceData = {
          type,
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime,
          timestamp: Date.now(),
          details: this.extractPerformanceDetails(entry)
        }
        this.log(perfData)
      }
    })

    observer.observe({ entryTypes: ['navigation', 'resource', 'paint'] })

    window.addEventListener('load', () => {
      if (performance.getEntriesByType('navigation').length > 0) {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        const navData: PerformanceData = {
          type: 'navigation',
          name: nav.name,
          duration: nav.duration,
          startTime: nav.startTime,
          timestamp: Date.now(),
          details: {
            domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
            domInteractive: nav.domInteractive,
            loadEventEnd: nav.loadEventEnd,
            redirectCount: nav.redirectCount,
            transferSize: nav.transferSize,
            encodedBodySize: nav.encodedBodySize,
            decodedBodySize: nav.decodedBodySize
          }
        }
        this.log(navData)
      }
    })
  }

  private extractPerformanceDetails(entry: PerformanceEntry): Record<string, unknown> {
    const details: Record<string, unknown> = {}
    
    if (entry.entryType === 'resource') {
      const resource = entry as PerformanceResourceTiming
      details.initiatorType = resource.initiatorType
      details.transferSize = resource.transferSize
      details.encodedBodySize = resource.encodedBodySize
      details.decodedBodySize = resource.decodedBodySize
      details.duration = resource.duration
      details.responseEnd = resource.responseEnd
    }
    
    if (entry.entryType === 'paint') {
      const paint = entry as PerformancePaintTiming
      details.renderTime = paint.startTime
    }

    return details
  }

  private initNetworkTracking() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          const resource = entry as PerformanceResourceTiming
          if (resource.initiatorType === 'xmlhttprequest' || resource.initiatorType === 'fetch') {
            const networkData: NetworkData = {
              url: resource.name,
              method: 'GET',
              status: 0,
              duration: resource.duration,
              transferSize: resource.transferSize,
              timestamp: Date.now()
            }
            this.log(networkData)
          }
        }
      }
    })

    observer.observe({ entryTypes: ['resource'] })
  }

  getBuffer() {
    return this.buffer
  }
}

new DataCollector()
