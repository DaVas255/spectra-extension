import {
	API_BASE_URL,
	POLLING_INTERVAL,
	BATCH_MAX_SIZE,
	BATCH_INTERVAL,
	ENDPOINTS
} from '../shared/constants'
import {
	SpectraEvent,
	TrackedSite,
	StorageData,
	Message
} from '../shared/types'

let eventBuffer: SpectraEvent[] = []
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
				const siteHost = new URL(site.url).host
				if (host === siteHost) return true
			} catch {}

			if (site.urlPattern) {
				const pattern = site.urlPattern
					.replace(/\./g, '\\.')
					.replace(/\*/g, '.*')
				const regex = new RegExp(`^${pattern}$`, 'i')
				if (regex.test(siteUrl) || regex.test(host)) return true
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
			headers: {
				'X-API-Key': apiKey,
				'Content-Type': 'application/json'
			}
		})

		if (!response.ok) throw new Error(`HTTP ${response.status}`)

		return await response.json()
	} catch {
		return []
	}
}

const sendEvents = async (
	apiKey: string,
	events: SpectraEvent[]
): Promise<void> => {
	const groups = events.reduce<Record<string, SpectraEvent[]>>((acc, event) => {
		const key = event.category
		if (!acc[key]) acc[key] = []
		acc[key].push(event)
		return acc
	}, {})

	const results = await Promise.allSettled(
		Object.entries(groups).map(([category, categoryEvents]) => {
			const endpoint = ENDPOINTS[category]
			if (!endpoint) return Promise.resolve()

			return fetch(`${API_BASE_URL}${endpoint}`, {
				method: 'POST',
				headers: {
					'X-API-Key': apiKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ events: categoryEvents })
			}).then(res => {
				if (!res.ok) throw new Error(`HTTP ${res.status} for ${endpoint}`)
			})
		})
	)

	const failedEvents = results.flatMap((result, i) => {
		if (result.status === 'rejected') {
			const category = Object.keys(groups)[i]
			return groups[category]
		}
		return []
	})

	if (failedEvents.length > 0) {
		eventBuffer.unshift(...failedEvents)
	}
}

const persistBuffer = (): Promise<void> => {
	return new Promise(resolve => {
		chrome.storage.session.set(
			{ eventBuffer, bufferSize: eventBuffer.length },
			() => resolve()
		)
	})
}

const restoreBuffer = (): Promise<void> => {
	return new Promise(resolve => {
		chrome.storage.session.get('eventBuffer', result => {
			if (Array.isArray(result.eventBuffer) && result.eventBuffer.length > 0) {
				eventBuffer = result.eventBuffer
				chrome.storage.session.set({ bufferSize: eventBuffer.length })
			}
			resolve()
		})
	})
}

const processEventBuffer = async () => {
	if (isProcessing || eventBuffer.length === 0) return

	const storage = await getStorage()
	if (!storage.apiKey) return

	isProcessing = true
	let eventsToSend: SpectraEvent[] = []

	try {
		eventsToSend = eventBuffer.splice(0, BATCH_MAX_SIZE)
		await sendEvents(storage.apiKey, eventsToSend)
		await persistBuffer()
	} catch {
		eventBuffer.unshift(...eventsToSend)
	} finally {
		isProcessing = false
	}
}

const startBatchTimer = async () => {
	const existing = await chrome.alarms.get('batchTimer')
	if (!existing) {
		chrome.alarms.create('batchTimer', {
			delayInMinutes: BATCH_INTERVAL / 60,
			periodInMinutes: BATCH_INTERVAL / 60
		})
	}
}

const startPolling = async () => {
	const storage = await getStorage()
	if (!storage.apiKey) return

	const sites = await fetchTrackedSites(storage.apiKey)
	await setStorage({ trackedSites: sites, lastSync: Date.now() })

	const existing = await chrome.alarms.get('pollingTimer')
	if (!existing) {
		chrome.alarms.create('pollingTimer', {
			delayInMinutes: POLLING_INTERVAL / 60,
			periodInMinutes: POLLING_INTERVAL / 60
		})
	}
}

const handleMessage = (
	request: Message,
	_sender: chrome.runtime.MessageSender,
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
				await startBatchTimer()
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
					bufferSize: eventBuffer.length
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

		case 'ADD_EVENT': {
			const event = request.payload as SpectraEvent
			getStorage().then(async storage => {
				if (!storage.apiKey) {
					sendResponse({ success: false, reason: 'No API key' })
					return
				}

				if (!isSiteTracked(event.url, storage.trackedSites)) {
					sendResponse({ success: false, reason: 'Site not tracked' })
					return
				}

				eventBuffer.push(event)
				await persistBuffer()

				if (eventBuffer.length >= BATCH_MAX_SIZE) {
					await processEventBuffer()
				}

				sendResponse({ success: true })
			})
			return true
		}

		case 'TOGGLE_MONITORING': {
			getStorage().then(storage => {
				sendResponse({ status: storage.apiKey ? 'Active' : 'Inactive' })
			})
			return true
		}

		default:
			sendResponse({ error: 'Unknown message type' })
	}
}

chrome.alarms.onAlarm.addListener(alarm => {
	if (alarm.name === 'batchTimer') {
		processEventBuffer()
	} else if (alarm.name === 'pollingTimer') {
		getStorage().then(async storage => {
			if (storage.apiKey) {
				const sites = await fetchTrackedSites(storage.apiKey)
				await setStorage({ trackedSites: sites, lastSync: Date.now() })
			}
		})
	}
})

chrome.runtime.onInstalled.addListener(() => {
	startBatchTimer()
})

chrome.runtime.onStartup.addListener(async () => {
	await restoreBuffer()
	await startBatchTimer()
	const storage = await getStorage()
	if (storage.apiKey) await startPolling()
})

chrome.runtime.onSuspend.addListener(() => {
	processEventBuffer()
})

chrome.runtime.onSuspendCanceled.addListener(() => {
	startBatchTimer()
})

chrome.runtime.onMessage.addListener(handleMessage)
