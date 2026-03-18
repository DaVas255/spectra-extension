window.__SPECTRA_INJECTED__ = true

const origFetch = window.fetch

const sendLog = (log: {
	url: string
	level: 'error' | 'warning' | 'info' | 'log'
	message: string
	stackTrace?: string
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
				metadata: log.metadata,
				timestamp: Date.now()
			}
		},
		() => {}
	)
}

window.fetch = async (...args) => {
	const url = typeof args[0] === 'string' ? args[0] : args[0].url

	try {
		const response = await origFetch(...args)

		if (!response.ok) {
			sendLog({
				url: window.location.href,
				level: 'error',
				message: `Fetch failed: ${response.status} ${response.statusText} - ${url}`,
				metadata: { fetchStatus: response.status }
			})
		}

		return response
	} catch (error: any) {
		sendLog({
			url: window.location.href,
			level: 'error',
			message: `Fetch error: ${error.message} - ${url}`,
			stackTrace: error.stack,
			metadata: { fetchError: true }
		})
		throw error
	}
}
