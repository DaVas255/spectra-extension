export interface LogEntry {
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

export interface TrackedSite {
	id: number
	url: string
	urlPattern?: string
	name?: string
	isActive: boolean
}

export interface StorageData {
	apiKey: string | null
	trackedSites: TrackedSite[]
	lastSync: number | null
}

export interface StatusResponse {
	apiKey: boolean
	sitesCount: number
	lastSync: number | null
	bufferSize: number
}

export interface SuccessResponse {
	success: boolean
	reason?: string
}

export type MessageType =
	| 'PING'
	| 'PONG'
	| 'SET_API_KEY'
	| 'GET_STATUS'
	| 'GET_TRACKED_SITES'
	| 'ADD_LOG'
	| 'TOGGLE_MONITORING'

export interface Message {
	type: MessageType
	payload?: unknown
}
