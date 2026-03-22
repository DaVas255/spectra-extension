import {
	API_BASE_URL,
	POLLING_INTERVAL,
	BATCH_MAX_SIZE,
	BATCH_INTERVAL
} from '../shared/constants'
import { ErrorEntry, TrackedSite, StorageData, Message } from '../shared/types'

let errorBuffer: ErrorEntry[] = []
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

const sendErrors = async (
	apiKey: string,
	errors: ErrorEntry[]
): Promise<void> => {
	const response = await fetch(`${API_BASE_URL}/errors`, {
		method: 'POST',
		headers: {
			'X-API-Key': apiKey,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ errors })
	})

	if (!response.ok) throw new Error(`HTTP ${response.status}`)
}

const persistBuffer = (): Promise<void> => {
	return new Promise(resolve => {
		chrome.storage.session.set(
			{
				errorBuffer,
				bufferSize: errorBuffer.length
			},
			() => resolve()
		)
	})
}

const restoreBuffer = async (): Promise<void> => {
	return new Promise(resolve => {
		chrome.storage.session.get('errorBuffer', result => {
			if (Array.isArray(result.errorBuffer) && result.errorBuffer.length > 0) {
				errorBuffer = result.errorBuffer
				chrome.storage.session.set({ bufferSize: errorBuffer.length })
			}
			resolve()
		})
	})
}

const processErrorBuffer = async () => {
	if (isProcessing || errorBuffer.length === 0) return

	const storage = await getStorage()
	if (!storage.apiKey) return

	isProcessing = true
	let errorsToSend: ErrorEntry[] = []

	try {
		errorsToSend = errorBuffer.splice(0, BATCH_MAX_SIZE)
		await sendErrors(storage.apiKey, errorsToSend)
		await persistBuffer()
	} catch {
		errorBuffer.unshift(...errorsToSend)
	} finally {
		isProcessing = false
	}
}

const startBatchTimer = () => {
	chrome.alarms.create('batchTimer', {
		delayInMinutes: BATCH_INTERVAL / 60,
		periodInMinutes: BATCH_INTERVAL / 60
	})
}

const startPolling = async () => {
	const storage = await getStorage()
	if (!storage.apiKey) return

	const sites = await fetchTrackedSites(storage.apiKey)
	await setStorage({ trackedSites: sites, lastSync: Date.now() })

	chrome.alarms.create('pollingTimer', {
		delayInMinutes: POLLING_INTERVAL,
		periodInMinutes: POLLING_INTERVAL
	})
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
					bufferSize: errorBuffer.length
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

		case 'ADD_ERROR': {
			const error = request.payload as ErrorEntry
			getStorage().then(async storage => {
				if (!storage.apiKey) {
					sendResponse({ success: false, reason: 'No API key' })
					return
				}

				if (!isSiteTracked(error.url, storage.trackedSites)) {
					sendResponse({ success: false, reason: 'Site not tracked' })
					return
				}

				errorBuffer.push(error)
				await persistBuffer()

				if (errorBuffer.length >= BATCH_MAX_SIZE) {
					await processErrorBuffer()
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
		processErrorBuffer()
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
	startBatchTimer()
	const storage = await getStorage()
	if (storage.apiKey) await startPolling()
})

chrome.runtime.onSuspend.addListener(() => {
	processErrorBuffer()
})

chrome.runtime.onSuspendCanceled.addListener(() => {
	startBatchTimer()
})

chrome.runtime.onMessage.addListener(handleMessage)
