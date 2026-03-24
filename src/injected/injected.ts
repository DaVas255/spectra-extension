import type { Metadata } from '../shared/types'

if ((window as any).__spectra_injected__) {
	throw new Error('already injected')
}
;(window as any).__spectra_injected__ = true

const getBrowser = (): string => {
	const ua = navigator.userAgent
	const match = (['Edg', 'Firefox', 'Chrome', 'Safari'] as const).find(b =>
		ua.includes(b)
	)
	return match === 'Edg' ? 'Edge' : (match ?? 'Unknown')
}

const getMetadata = (): Metadata => ({
	userAgent: navigator.userAgent,
	viewport: `${window.innerWidth}x${window.innerHeight}`,
	browser: getBrowser()
})

const sendEvent = (event: any) => {
	window.postMessage(
		{
			__spectra: true,
			type: 'ADD_EVENT',
			payload: {
				...event,
				url: window.location.href,
				metadata: getMetadata(),
				timestamp: Date.now()
			}
		},
		'*'
	)
}
// ─── Ошибки ──────────────────────────────────────────────────────────────────

window.addEventListener('error', event => {
	sendEvent({
		category: 'error',
		source: 'window.onerror',
		type: event.error?.name || 'Error',
		message: event.error?.message || event.message,
		stackTrace: event.error?.stack,
		fileName: event.filename,
		lineNumber: event.lineno,
		columnNumber: event.colno
	})
})

window.addEventListener('unhandledrejection', event => {
	sendEvent({
		category: 'error',
		source: 'unhandledrejection',
		type: event.reason?.name || 'UnhandledRejection',
		message: event.reason?.message || String(event.reason),
		stackTrace: event.reason?.stack
	})
})

const origError = console.error.bind(console)
console.error = (...args: unknown[]) => {
	origError(...args)
	sendEvent({
		category: 'error',
		source: 'console.error',
		type: args[0] instanceof Error ? args[0].name : 'Error',
		message: args
			.map(a => (a instanceof Error ? a.message : String(a)))
			.join(' '),
		stackTrace: args[0] instanceof Error ? args[0].stack : undefined
	})
}

// ─── Предупреждения ──────────────────────────────────────────────────────────

const origWarn = console.warn.bind(console)
console.warn = (...args: unknown[]) => {
	origWarn(...args)
	sendEvent({
		category: 'warning',
		source: 'console.warn',
		message: args
			.map(a => (a instanceof Error ? a.message : String(a)))
			.join(' '),
		stackTrace: args[0] instanceof Error ? args[0].stack : undefined
	})
}

// ─── Info / Log ───────────────────────────────────────────────────────────────

const origInfo = console.info.bind(console)
console.info = (...args: unknown[]) => {
	origInfo(...args)
	sendEvent({
		category: 'info',
		source: 'console.info',
		message: args
			.map(a => (a instanceof Error ? a.message : String(a)))
			.join(' ')
	})
}

const origLog = console.log.bind(console)
console.log = (...args: unknown[]) => {
	origLog(...args)
	sendEvent({
		category: 'log',
		source: 'console.log',
		message: args
			.map(a => (a instanceof Error ? a.message : String(a)))
			.join(' ')
	})
}

// ─── Сеть ────────────────────────────────────────────────────────────────────

// const origFetch = window.fetch
// window.fetch = async (...args) => {
// 	const requestUrl =
// 		typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
// 	const method = ((args[1] as RequestInit)?.method || 'GET').toUpperCase()
// 	const start = performance.now()

// 	try {
// 		const res = await origFetch(...args)
// 		const duration = Math.round(performance.now() - start)

// 		if (!res.ok || duration > 3000) {
// 			sendEvent({
// 				category: 'network',
// 				source: 'fetch',
// 				requestUrl,
// 				method,
// 				status: res.status,
// 				duration,
// 				failed: !res.ok
// 			})
// 		}

// 		return res
// 	} catch (e: any) {
// 		sendEvent({
// 			category: 'network',
// 			source: 'fetch',
// 			requestUrl,
// 			method,
// 			duration: Math.round(performance.now() - start),
// 			failed: true
// 		})
// 		throw e
// 	}
// }

// // ─── Перформанс ──────────────────────────────────────────────────────────────

// new PerformanceObserver(list => {
// 	for (const entry of list.getEntries()) {
// 		sendEvent({
// 			category: 'performance',
// 			metricType: 'long-task',
// 			metricName: 'long-task',
// 			value: Math.round(entry.duration),
// 			browser: getBrowser()
// 		})
// 	}
// }).observe({ entryTypes: ['longtask'] })

// new PerformanceObserver(list => {
// 	for (const entry of list.getEntries()) {
// 		if (entry.entryType === 'largest-contentful-paint') {
// 			sendEvent({
// 				category: 'performance',
// 				metricType: 'web-vital',
// 				metricName: 'LCP',
// 				value: Math.round(entry.startTime),
// 				browser: getBrowser()
// 			})
// 		}

// 		if (entry.entryType === 'first-input') {
// 			const e = entry as PerformanceEventTiming
// 			sendEvent({
// 				category: 'performance',
// 				metricType: 'web-vital',
// 				metricName: 'FID',
// 				value: Math.round(e.processingStart - e.startTime),
// 				browser: getBrowser()
// 			})
// 		}

// 		if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
// 			sendEvent({
// 				category: 'performance',
// 				metricType: 'web-vital',
// 				metricName: 'CLS',
// 				value: parseFloat(((entry as any).value as number).toFixed(4)),
// 				browser: getBrowser()
// 			})
// 		}
// 	}
// }).observe({
// 	entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift']
// })

// new PerformanceObserver(list => {
// 	for (const entry of list.getEntries()) {
// 		const res = entry as PerformanceResourceTiming
// 		if (res.duration > 1000) {
// 			sendEvent({
// 				category: 'performance',
// 				metricType: 'resource',
// 				metricName: 'slow-resource',
// 				value: Math.round(res.duration),
// 				browser: getBrowser()
// 			})
// 		}
// 	}
// }).observe({ entryTypes: ['resource'] })

// window.addEventListener('load', () => {
// 	setTimeout(() => {
// 		const nav = performance.getEntriesByType(
// 			'navigation'
// 		)[0] as PerformanceNavigationTiming
// 		if (!nav) return

// 		const ttfb = nav.responseStart - nav.requestStart
// 		const fcp = performance.getEntriesByName('first-contentful-paint')[0]

// 		sendEvent({
// 			category: 'performance',
// 			metricType: 'web-vital',
// 			metricName: 'TTFB',
// 			value: Math.round(ttfb),
// 			browser: getBrowser()
// 		})

// 		if (fcp) {
// 			sendEvent({
// 				category: 'performance',
// 				metricType: 'web-vital',
// 				metricName: 'FCP',
// 				value: Math.round(fcp.startTime),
// 				browser: getBrowser()
// 			})
// 		}

// 		sendEvent({
// 			category: 'performance',
// 			metricType: 'navigation',
// 			metricName: 'navigation',
// 			value: Math.round(nav.loadEventEnd),
// 			browser: getBrowser()
// 		})
// 	}, 0)
// })

// // ─── UX ──────────────────────────────────────────────────────────────────────

// const describeElement = (el: Element): string => {
// 	const tag = el.tagName
// 	const role =
// 		el.getAttribute('role') ||
// 		el.getAttribute('aria-label') ||
// 		el.getAttribute('type') ||
// 		'-'
// 	const text = el.textContent?.trim().slice(0, 60) || '-'
// 	return `${tag} | ${role} | "${text}"`
// }

// let clickCount = 0
// let clickTimer: ReturnType<typeof setTimeout>
// let lastClickTarget: EventTarget | null = null

// document.addEventListener(
// 	'click',
// 	event => {
// 		if (event.target === lastClickTarget) {
// 			clickCount++
// 		} else {
// 			clickCount = 1
// 			lastClickTarget = event.target
// 		}

// 		clearTimeout(clickTimer)
// 		clickTimer = setTimeout(() => {
// 			if (clickCount >= 3 && event.target instanceof Element) {
// 				sendEvent({
// 					category: 'user-action',
// 					actionType: 'rage-click',
// 					element: describeElement(event.target)
// 				})
// 			}
// 			clickCount = 0
// 		}, 500)
// 	},
// 	{ capture: true }
// )

// window.addEventListener('offline', () => {
// 	sendEvent({ category: 'user-action', actionType: 'offline' })
// })

// window.addEventListener('online', () => {
// 	sendEvent({ category: 'user-action', actionType: 'online' })
// })

// document.addEventListener('visibilitychange', () => {
// 	sendEvent({
// 		category: 'user-action',
// 		actionType: 'visibility-change',
// 		value: document.visibilityState
// 	})
// })

// // ─── Безопасность ────────────────────────────────────────────────────────────

// document.addEventListener('securitypolicyviolation', e => {
// 	sendEvent({
// 		category: 'security',
// 		type: 'csp-violation',
// 		directive: e.violatedDirective,
// 		blockedURI: e.blockedURI
// 	})
// })
