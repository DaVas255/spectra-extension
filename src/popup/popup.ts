const apiKeyInput = document.getElementById('api-key') as HTMLInputElement
const saveButton = document.getElementById('save-button')
const clearButton = document.getElementById('clear-button')
const statusElement = document.getElementById('status')
const sitesCountElement = document.getElementById('sites-count')
const lastSyncElement = document.getElementById('last-sync')
const versionElement = document.getElementById('version')
const bufferSizeElement = document.getElementById('buffer-size')

const initPopup = () => {
	if (versionElement) {
		const manifest = chrome.runtime.getManifest()
		versionElement.textContent = 'v' + manifest.version
	}

	updateStatus()
}

const updateStatus = () => {
	chrome.runtime.sendMessage({ type: 'GET_STATUS' }, response => {
		if (response?.apiKey) {
			if (statusElement) {
				statusElement.textContent = 'Подключено'
				statusElement.className = 'status status-active'
			}
			if (apiKeyInput) {
				apiKeyInput.value = '********'
				apiKeyInput.disabled = true
			}
			if (saveButton) saveButton.style.display = 'none'
			if (clearButton) clearButton.style.display = 'block'
		} else {
			if (statusElement) {
				statusElement.textContent = 'Не подключено'
				statusElement.className = 'status status-inactive'
			}
			if (apiKeyInput) {
				apiKeyInput.value = ''
				apiKeyInput.disabled = false
			}
			if (saveButton) saveButton.style.display = 'block'
			if (clearButton) clearButton.style.display = 'none'
		}

		if (sitesCountElement) {
			sitesCountElement.textContent = `Сайтов: ${response?.sitesCount || 0}`
		}

		if (lastSyncElement && response?.lastSync) {
			const date = new Date(response.lastSync)
			lastSyncElement.textContent = `Синхронизация: ${date.toLocaleTimeString()}`
		}

		if (bufferSizeElement) {
			bufferSizeElement.textContent = `В буфере: ${response?.bufferSize || 0}`
		}
	})
}

const saveApiKey = () => {
	const apiKey = apiKeyInput.value.trim()

	if (!apiKey) {
		alert('Введите API ключ')
		return
	}

	if (!apiKey.startsWith('sk_live_')) {
		alert('Неверный формат API ключа')
		return
	}

	chrome.runtime.sendMessage(
		{ type: 'SET_API_KEY', payload: apiKey },
		response => {
			if (response?.success) {
				updateStatus()
			}
		}
	)
}

const clearApiKey = () => {
	chrome.storage.local.clear(() => {
		updateStatus()
	})
}

saveButton?.addEventListener('click', saveApiKey)
clearButton?.addEventListener('click', clearApiKey)

chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName === 'session' && changes.bufferSize) {
		if (bufferSizeElement) {
			bufferSizeElement.textContent = `В буфере: ${changes.bufferSize.newValue}`
		}
	}
})

document.addEventListener('DOMContentLoaded', initPopup)
