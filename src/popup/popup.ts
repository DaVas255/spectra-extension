console.log('[Spectra] Popup script started')

const statusElement = document.getElementById('status')
const versionElement = document.getElementById('version')
const toggleButton = document.getElementById('toggle-button')

const initPopup = () => {
	console.log('[Spectra] Popup initialized')

	if (versionElement) {
		chrome.runtime.getManifest().then((manifest: chrome.runtime.Manifest) => {
			versionElement.textContent = 'v' + manifest.version
		})
	}

	updateStatus()
}

const updateStatus = () => {
	chrome.runtime.sendMessage({ type: 'GET_STATUS' }, response => {
		if (statusElement) {
			statusElement.textContent = response?.status || 'Unknown'
		}
	})
}

const toggleMonitoring = () => {
	console.log('[Spectra] Toggle monitoring clicked')

	chrome.runtime.sendMessage({ type: 'TOGGLE_MONITORING' }, response => {
		if (statusElement) {
			statusElement.textContent = response?.status || 'Unknown'
		}
	})
}

toggleButton?.addEventListener('click', toggleMonitoring)

document.addEventListener('DOMContentLoaded', initPopup)

console.log('[Spectra] Popup script initialized')
