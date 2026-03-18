const getMetadata = () => ({
	userAgent: navigator.userAgent,
	viewport: `${window.innerWidth}x${window.innerHeight}`,
	platform: navigator.platform,
	browser: getBrowser()
})

const getBrowser = (): string => {
	const ua = navigator.userAgent
	if (ua.includes('Chrome')) return 'Chrome'
	if (ua.includes('Firefox')) return 'Firefox'
	if (ua.includes('Safari')) return 'Safari'
	if (ua.includes('Edge')) return 'Edge'
	return 'Unknown'
}

const origError = console.error.bind(console)
const origWarn = console.warn.bind(console)

const sendLog = (log: {
	url: string
	level: 'error' | 'warning' | 'info' | 'log'
	message: string
	stackTrace?: string
	fileName?: string
	lineNumber?: number
	columnNumber?: number
	metadata?: object
}) => {
	chrome.runtime.sendMessage(
		{
			type: 'ADD_LOG',
			payload: {
				url: log.url,
				level: log.level,
				message: log.message,
				stackTrace: log.stackTrace,
				fileName: log.fileName,
				lineNumber: log.lineNumber,
				columnNumber: log.columnNumber,
				metadata: log.metadata,
				timestamp: Date.now()
			}
		},
		() => {}
	)
}

window.addEventListener('error', event => {
	sendLog({
		url: window.location.href,
		level: 'error',
		message: event.error?.message || event.message || 'Unknown error',
		stackTrace: event.error?.stack,
		fileName: event.filename,
		lineNumber: event.lineno,
		columnNumber: event.colno,
		metadata: getMetadata()
	})
})

window.addEventListener('unhandledrejection', event => {
	sendLog({
		url: window.location.href,
		level: 'error',
		message: event.reason?.message || String(event.reason),
		stackTrace: event.reason?.stack,
		metadata: getMetadata()
	})
})

console.error = function (...args: unknown[]) {
	origError.apply(console, args)

	const message = args
		.map(arg => {
			if (arg instanceof Error) return arg.message
			if (typeof arg === 'object') {
				try {
					return JSON.stringify(arg)
				} catch {
					return String(arg)
				}
			}
			return String(arg)
		})
		.join(' ')

	sendLog({
		url: window.location.href,
		level: 'error',
		message,
		stackTrace: args[0] instanceof Error ? args[0].stack : undefined,
		metadata: getMetadata()
	})
}

console.warn = function (...args: unknown[]) {
	origWarn.apply(console, args)

	const message = args
		.map(arg => {
			if (arg instanceof Error) return arg.message
			if (typeof arg === 'object') {
				try {
					return JSON.stringify(arg)
				} catch {
					return String(arg)
				}
			}
			return String(arg)
		})
		.join(' ')

	sendLog({
		url: window.location.href,
		level: 'warning',
		message,
		stackTrace: args[0] instanceof Error ? args[0].stack : undefined,
		metadata: getMetadata()
	})
}

const injectScript = () => {
	try {
		const script = document.createElement('script')
		script.src = chrome.runtime.getURL('injected.js')
		script.onload = () => script.remove()
		document.documentElement.appendChild(script)
	} catch {}
}

if (document.documentElement) {
	injectScript()
} else {
	document.addEventListener('DOMContentLoaded', injectScript)
}
