export interface Metadata {
	userAgent?: string
	viewport?: string
	browser?: string
}

export interface BaseEvent {
	url: string
	timestamp: number
	metadata?: Metadata
}

export interface ErrorEvent extends BaseEvent {
	category: 'error'
	type: string
	message: string
	stackTrace?: string
	fileName?: string
	lineNumber?: number
	columnNumber?: number
	source: 'window.onerror' | 'unhandledrejection' | 'console.error'
}

export interface WarningEvent extends BaseEvent {
	category: 'warning'
	message: string
	stackTrace?: string
	source: 'console.warn'
}

export interface InfoEvent extends BaseEvent {
	category: 'info'
	message: string
	source: 'console.info'
}

export interface LogEvent extends BaseEvent {
	category: 'log'
	message: string
	source: 'console.log'
}

export interface PerformanceEvent extends BaseEvent {
	category: 'performance'
	metricType: 'web-vital' | 'navigation' | 'long-task' | 'resource'
	metricName:
		| 'LCP'
		| 'FID'
		| 'CLS'
		| 'TTFB'
		| 'FCP'
		| 'long-task'
		| 'slow-resource'
		| 'navigation'
	value: number
	browser?: string
}

export interface NetworkEvent extends BaseEvent {
	category: 'network'
	method: string
	requestUrl: string
	status?: number
	duration?: number
	failed: boolean
	source: 'fetch'
	pageUrl: string
}

export interface UserActionEvent extends BaseEvent {
	category: 'user-action'
	actionType: 'rage-click' | 'offline' | 'online' | 'visibility-change'
	element?: string
	value?: string
}

export interface SecurityEvent extends BaseEvent {
	category: 'security'
	type: 'csp-violation'
	directive?: string
	blockedURI?: string
}

export type SpectraEvent =
	| ErrorEvent
	| WarningEvent
	| InfoEvent
	| LogEvent
	| PerformanceEvent
	| NetworkEvent
	| UserActionEvent
	| SecurityEvent

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
	| 'ADD_EVENT'
	| 'TOGGLE_MONITORING'

export interface Message {
	type: MessageType
	payload?: unknown
}
