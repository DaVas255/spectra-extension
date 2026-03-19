window.addEventListener('message', event => {
	if (event.source !== window || !event.data?.__spectra) return
	chrome.runtime.sendMessage(
		{ type: event.data.type, payload: event.data.payload },
		() => {
			void chrome.runtime.lastError
		}
	)
})

const injectScript = () => {
	const script = document.createElement('script')
	script.src = chrome.runtime.getURL('injected.js')
	script.onload = () => script.remove()
	document.documentElement.appendChild(script)
}

document.documentElement
	? injectScript()
	: document.addEventListener('DOMContentLoaded', injectScript)
