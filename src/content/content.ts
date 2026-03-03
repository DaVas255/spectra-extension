console.log('[Spectra] Content script injected')

const monitorPage = () => {
	console.log('[Spectra] Page loaded: ', window.location.href)

	chrome.runtime.sendMessage({
		type: 'PAGE_LOADED',
		url: window.location.href,
		title: document.title,
		timestamp: Date.now()
	})
}

if (document.readyState === 'loading') {
	window.addEventListener('DOMContentLoaded', monitorPage)
} else {
	monitorPage()
}

window.addEventListener('beforeunload', () => {
	console.log('[Spectra] Page unloaded: ', window.location.href)
})

window.addEventListener('error', event => {
	console.log('[Spectra] Error captured:', event.error)

	chrome.runtime.sendMessage({
		type: 'ERROR_CAPTURED',
		error: {
			message: event.error?.message,
			filename: event.filename,
			lineno: event.lineno,
			colno: event.colno,
			timestamp: Date.now()
		}
	})
})

console.log('[Spectra] Content script initialized')
