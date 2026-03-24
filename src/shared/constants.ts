export const API_BASE_URL = 'http://localhost:4200/api'
export const POLLING_INTERVAL = 10
export const BATCH_MAX_SIZE = 20
export const BATCH_INTERVAL = 5

export const ENDPOINTS: Record<string, string> = {
	error: '/errors',
	warning: '/warnings',
	info: '/infos',
	log: '/logs',
	performance: '/performance',
	network: '/network-requests',
	'user-action': '/user-actions',
	security: '/security-events'
}
