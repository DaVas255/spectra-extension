console.log('[Spectra] Popup script started')

const apiKeyInput = document.getElementById('api-key') as HTMLInputElement
const saveButton = document.getElementById('save-button')
const statusElement = document.getElementById('status')
const sitesCountElement = document.getElementById('sites-count')
const lastSyncElement = document.getElementById('last-sync')
const versionElement = document.getElementById('version')
const bufferSizeElement = document.getElementById('buffer-size')

const initPopup = async () => {
	console.log('[Spectra] Popup initialized')

	if (versionElement) {
		const manifest = chrome.runtime.getManifest()
		versionElement.textContent = 'v' + manifest.version
	}

	await updateStatus()
}

const updateStatus = () => {
	chrome.runtime.sendMessage({ type: 'GET_STATUS' }, response => {
		if (response?.apiKey) {
			if (statusElement) {
				statusElement.textContent = 'Подключено'
				statusElement.className = 'status status-active'
			}
			if (apiKeyInput) {
				apiKeyInput.value = response.apiKey ? '********' : ''
				apiKeyInput.disabled = true
			}
			if (saveButton) {
				saveButton.textContent = 'Изменить'
			}
		} else {
			if (statusElement) {
				statusElement.textContent = 'Не подключено'
				statusElement.className = 'status status-inactive'
			}
		}

		if (sitesCountElement && response?.sitesCount !== undefined) {
			sitesCountElement.textContent = `Сайтов: ${response.sitesCount}`
		}

		if (lastSyncElement && response?.lastSync) {
			const date = new Date(response.lastSync)
			lastSyncElement.textContent = `Синхронизация: ${date.toLocaleTimeString()}`
		}

		if (bufferSizeElement && response?.bufferSize !== undefined) {
			bufferSizeElement.textContent = `В буфере: ${response.bufferSize}`
		}
	})
}

const saveApiKey = async () => {
	const apiKey = apiKeyInput?.value.trim()

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
				alert('API ключ сохранен')
				updateStatus()
			} else {
				alert('Ошибка сохранения API ключа')
			}
		}
	)
}

const clearApiKey = async () => {
	chrome.storage.local.clear()
	alert('API ключ удален')
	if (apiKeyInput) {
		apiKeyInput.value = ''
		apiKeyInput.disabled = false
	}
	if (saveButton) {
		saveButton.textContent = 'Сохранить'
	}
	updateStatus()
}

saveButton?.addEventListener('click', () => {
	if (saveButton.textContent === 'Изменить') {
		if (apiKeyInput) {
			apiKeyInput.disabled = false
			apiKeyInput.value = ''
		}
		saveButton.textContent = 'Сохранить'
	} else {
		saveApiKey()
	}
})

document.addEventListener('DOMContentLoaded', initPopup)

console.log('[Spectra] Popup script initialized')
