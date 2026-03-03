console.log('[Spectra] Background service worker started')

chrome.runtime.onInstalled.addListener(details => {
	console.log('[Spectra] Extension installed')
})

chrome.runtime.onStartup.addListener(() => {
	console.log('[Spectra] Browser started')
})

chrome.runtime.onSuspend.addListener(() => {
	console.log('[Spectra] Background service suspended')
})

chrome.runtime.onSuspendCanceled.addListener(() => {
	console.log('[Spectra] Background service resumed')
})

// Basic message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log('[Spectra] Received message:', request)

	if (request.type === 'PING') {
		sendResponse({ type: 'PONG', timestamp: Date.now() })
		return true
	}
})

console.log('[Spectra] Background service worker initialized')
