const API_BASE_URL = 'http://localhost:4200/api'
const POLLING_INTERVAL = 30
const BATCH_MAX_SIZE = 20
const BATCH_INTERVAL = 5

interface LogEntry {
	url: string
	level: 'error' | 'warning' | 'info' | 'log'
	message: string
	stackTrace?: string
	fileName?: string
	lineNumber?: number
	columnNumber?: number
	metadata?: {
		userAgent?: string
		viewport?: string
		os?: string
		browser?: string
	}
	timestamp: number
}

interface TrackedSite {
	id: number
	url: string
	urlPattern?: string
	name?: string
	isActive: boolean
}

interface StorageData {
	apiKey: string | null
	trackedSites: TrackedSite[]
	lastSync: number | null
}

let logBuffer: LogEntry[] = []
let isProcessing = false

const getStorage = (): Promise<StorageData> => {
	return new Promise(resolve => {
		chrome.storage.local.get(['apiKey', 'trackedSites', 'lastSync'], result => {
			resolve({
				apiKey: result.apiKey || null,
				trackedSites: result.trackedSites || [],
				lastSync: result.lastSync || null
			})
		})
	})
}

const setStorage = (data: Partial<StorageData>): Promise<void> => {
	return new Promise(resolve => {
		chrome.storage.local.set(data, () => resolve())
	})
}

const isSiteTracked = (siteUrl: string, sites: TrackedSite[]): boolean => {
	try {
		const url = new URL(siteUrl)
		const host = url.host

		for (const site of sites) {
			if (!site.isActive) continue

			if (site.urlPattern) {
				const pattern = site.urlPattern
					.replace(/\./g, '\\.')
					.replace(/\*/g, '.*')
				const regex = new RegExp(`^${pattern}$`, 'i')
				if (regex.test(siteUrl) || regex.test(host)) {
					return true
				}
			}

			if (site.url.includes(host)) {
				return true
			}
		}
		return false
	} catch {
		return false
	}
}

const fetchTrackedSites = async (apiKey: string): Promise<TrackedSite[]> => {
	try {
		const response = await fetch(`${API_BASE_URL}/public/tracked-sites`, {
			method: 'GET',
			headers: {
				'X-API-Key': apiKey,
				'Content-Type': 'application/json'
			}
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}

		return await response.json()
	} catch (error) {
		console.error('[Spectra] Failed to fetch tracked sites:', error)
		return []
	}
}

const sendLogs = async (apiKey: string, logs: LogEntry[]): Promise<{ new: number; grouped: number }> => {
	try {
		const response = await fetch(`${API_BASE_URL}/user-logs`, {
			method: 'POST',
			headers: {
				'X-API-Key': apiKey,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ logs })
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}

		return await response.json()
	} catch (error) {
		console.error('[Spectra] Failed to send logs:', error)
		throw error
	}
}

const processLogBuffer = async () => {
	if (isProcessing || logBuffer.length === 0) return

	const storage = await getStorage()
	if (!storage.apiKey) {
		console.log('[Spectra] No API key, skipping log submission')
		return
	}

	isProcessing = true

	try {
		const logsToSend = logBuffer.splice(0, BATCH_MAX_SIZE)
		const result = await sendLogs(storage.apiKey, logsToSend)
		console.log(`[Spectra] Sent ${logsToSend.length} logs: new=${result.new}, grouped=${result.grouped}`)
	} catch (error) {
		logBuffer.unshift(...logBuffer.splice(0, BATCH_MAX_SIZE))
		console.error('[Spectra] Failed to process logs, will retry')
	} finally {
		isProcessing = false
	}
}

const startBatchTimer = () => {
	chrome.alarms.create('batchTimer', { delayInMinutes: BATCH_INTERVAL / 60, periodInMinutes: BATCH_INTERVAL / 60 })
}

const startPolling = async () => {
	const storage = await getStorage()
	if (!storage.apiKey) {
		console.log('[Spectra] No API key, skipping polling')
		return
	}

	const sites = await fetchTrackedSites(storage.apiKey)
	await setStorage({
		trackedSites: sites,
		lastSync: Date.now()
	})
	console.log(`[Spectra] Synced ${sites.length} tracked sites`)

	chrome.alarms.create('pollingTimer', { delayInMinutes: POLLING_INTERVAL, periodInMinutes: POLLING_INTERVAL })
}

const handleMessage = (
	request: { type: string; payload?: unknown },
	sender: chrome.runtime.MessageSender,
	sendResponse: (response?: unknown) => void
) => {
	console.log('[Spectra] Received message:', request)

	switch (request.type) {
		case 'PING':
			sendResponse({ type: 'PONG', timestamp: Date.now() })
			break

		case 'SET_API_KEY': {
			const apiKey = request.payload as string
			setStorage({ apiKey }).then(async () => {
				console.log('[Spectra] API key saved')
				await startPolling()
				startBatchTimer()
				sendResponse({ success: true })
			})
			return true
		}

		case 'GET_STATUS': {
			getStorage().then(storage => {
				sendResponse({
					apiKey: !!storage.apiKey,
					sitesCount: storage.trackedSites.length,
					lastSync: storage.lastSync,
					bufferSize: logBuffer.length
				})
			})
			return true
		}

		case 'GET_TRACKED_SITES': {
			getStorage().then(storage => {
				sendResponse({ sites: storage.trackedSites })
			})
			return true
		}

		case 'ADD_LOG': {
			const log = request.payload as LogEntry
			getStorage().then(async storage => {
				if (!storage.apiKey) {
					sendResponse({ success: false, reason: 'No API key' })
					return
				}

				const isTracked = isSiteTracked(log.url, storage.trackedSites)
				if (!isTracked) {
					sendResponse({ success: false, reason: 'Site not tracked' })
					return
				}

				logBuffer.push(log)
				console.log(`[Spectra] Log added, buffer size: ${logBuffer.length}`)

				if (logBuffer.length >= BATCH_MAX_SIZE) {
					await processLogBuffer()
				}

				sendResponse({ success: true })
			})
			return true
		}

		case 'TOGGLE_MONITORING': {
			getStorage().then(storage => {
				sendResponse({
					status: storage.apiKey ? 'Active' : 'Inactive'
				})
			})
			return true
		}

		default:
			sendResponse({ error: 'Unknown message type' })
	}
}

chrome.alarms.onAlarm.addListener(alarm => {
	if (alarm.name === 'batchTimer') {
		processLogBuffer()
	} else if (alarm.name === 'pollingTimer') {
		getStorage().then(async storage => {
			if (storage.apiKey) {
				const sites = await fetchTrackedSites(storage.apiKey)
				await setStorage({
					trackedSites: sites,
					lastSync: Date.now()
				})
				console.log(`[Spectra] Synced ${sites.length} tracked sites`)
			}
		})
	}
})

chrome.runtime.onInstalled.addListener(details => {
	console.log('[Spectra] Extension installed:', details.reason)
	startBatchTimer()
})

chrome.runtime.onStartup.addListener(() => {
	console.log('[Spectra] Browser started')
	startBatchTimer()
	getStorage().then(storage => {
		if (storage.apiKey) {
			startPolling()
		}
	})
})

chrome.runtime.onSuspend.addListener(() => {
	console.log('[Spectra] Background service suspended')
	processLogBuffer()
})

chrome.runtime.onSuspendCanceled.addListener(() => {
	console.log('[Spectra] Background service resumed')
	startBatchTimer()
})

chrome.runtime.onMessage.addListener(handleMessage)

console.log('[Spectra] Background service worker initialized')
