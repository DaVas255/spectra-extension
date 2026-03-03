console.log('[Spectra] Injected script loaded')

const monitorDOM = () => {
	console.log('[Spectra] DOM ready on ', window.location.href)

	const iframes = document.querySelectorAll('iframe')
	if (iframes.length > 0) {
		console.log('[Spectra] Found ', iframes.length, 'iframes')
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', monitorDOM)
} else {
	monitorDOM()
}

const originalFetch = window.fetch
window.fetch = async (...args) => {
	const startTime = performance.now()

	try {
		const response = await originalFetch(...args)
		const endTime = performance.now()

		console.log('[Spectra] Fetch completed:', {
			url: args[0],
			method: args[1]?.method || 'GET',
			duration: endTime - startTime,
			status: response.status
		})

		return response
	} catch (error: any) {
		console.log('[Spectra] Fetch error:', {
			url: args[0],
			method: args[1]?.method || 'GET',
			error: error.message
		})

		throw error
	}
}

console.log('[Spectra] Injected script initialized')
