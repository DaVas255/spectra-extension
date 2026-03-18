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

			try {
				const siteUrlObj = new URL(site.url)
				const siteHost = siteUrlObj.host

				if (host === siteHost) {
					return true
				}
			} catch {}

			if (site.urlPattern) {
				const pattern = site.urlPattern
					.replace(/\./g, '\\.')
					.replace(/\*/g, '.*')
				const regex = new RegExp(`^${pattern}$`, 'i')
				if (regex.test(siteUrl) || regex.test(host)) {
					return true
				}
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
	} catch {
		return []
	}
}

const sendLogs = async (apiKey: string, logs: LogEntry[]): Promise<{ new: number; grouped: number }> => {
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
}

const processLogBuffer = async () => {
	if (isProcessing || logBuffer.length === 0) return

	const storage = await getStorage()
	if (!storage.apiKey) return

	isProcessing = true
	let logsToSend: LogEntry[] = []

	try {
		logsToSend = logBuffer.splice(0, BATCH_MAX_SIZE)
		await sendLogs(storage.apiKey, logsToSend)
	} catch {
		if (logsToSend.length > 0) {
			logBuffer.unshift(...logsToSend)
		}
	} finally {
		isProcessing = false
	}
}

const startBatchTimer = () => {
	chrome.alarms.create('batchTimer', { delayInMinutes: BATCH_INTERVAL / 60, periodInMinutes: BATCH_INTERVAL / 60 })
}

const startPolling = async () => {
	const storage = await getStorage()
	if (!storage.apiKey) return

	const sites = await fetchTrackedSites(storage.apiKey)
	await setStorage({
		trackedSites: sites,
		lastSync: Date.now()
	})

	chrome.alarms.create('pollingTimer', { delayInMinutes: POLLING_INTERVAL, periodInMinutes: POLLING_INTERVAL })
}

const handleMessage = (
	request: { type: string; payload?: unknown },
	sender: chrome.runtime.MessageSender,
	sendResponse: (response?: unknown) => void
) => {
	switch (request.type) {
		case 'PING':
			sendResponse({ type: 'PONG', timestamp: Date.now() })
			break

		case 'SET_API_KEY': {
			const apiKey = request.payload as string
			setStorage({ apiKey }).then(async () => {
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
			}
		})
	}
})

chrome.runtime.onInstalled.addListener(() => {
	startBatchTimer()
})

chrome.runtime.onStartup.addListener(() => {
	startBatchTimer()
	getStorage().then(storage => {
		if (storage.apiKey) {
			startPolling()
		}
	})
})

chrome.runtime.onSuspend.addListener(() => {
	processLogBuffer()
})

chrome.runtime.onSuspendCanceled.addListener(() => {
	startBatchTimer()
})

chrome.runtime.onMessage.addListener(handleMessage)
