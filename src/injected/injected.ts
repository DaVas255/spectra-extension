import type { ErrorEntry } from '../shared/types'

if ((window as any).__spectra_injected__) {
	throw new Error('already injected')
}
;(window as any).__spectra_injected__ = true

const getMetadata = () => ({
	userAgent: navigator.userAgent,
	viewport: `${window.innerWidth}x${window.innerHeight}`,
	browser: navigator.userAgent.includes('Firefox')
		? 'Firefox'
		: navigator.userAgent.includes('Edg')
			? 'Edge'
			: navigator.userAgent.includes('Chrome')
				? 'Chrome'
				: navigator.userAgent.includes('Safari')
					? 'Safari'
					: 'Unknown'
})

const sendError = (
	error: Omit<ErrorEntry, 'url' | 'metadata' | 'timestamp'>
) => {
	window.postMessage(
		{
			__spectra: true,
			type: 'ADD_ERROR',
			payload: {
				...error,
				url: window.location.href,
				metadata: getMetadata(),
				timestamp: Date.now()
			}
		},
		'*'
	)
}

window.addEventListener('error', event => {
	sendError({
		message: event.error?.message || event.message,
		stackTrace: event.error?.stack,
		fileName: event.filename,
		lineNumber: event.lineno,
		columnNumber: event.colno
	})
})

window.addEventListener('unhandledrejection', event => {
	sendError({
		message: event.reason?.message || String(event.reason),
		stackTrace: event.reason?.stack
	})
})

const origError = console.error.bind(console)
console.error = function (...args: unknown[]) {
	origError(...args)
	sendError({
		message: args
			.map(a => (a instanceof Error ? a.message : String(a)))
			.join(' '),
		stackTrace: args[0] instanceof Error ? args[0].stack : undefined
	})
}

const origFetch = window.fetch
window.fetch = async (...args) => {
	const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
	try {
		const res = await origFetch(...args)
		if (!res.ok) {
			sendError({
				message: `HTTP ${res.status} ${url}`
			})
		}
		return res
	} catch (e: any) {
		sendError({
			message: `Fetch failed: ${e.message} — ${url}`,
			stackTrace: e.stack
		})
		throw e
	}
}
