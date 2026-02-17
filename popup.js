document.addEventListener('DOMContentLoaded', () => {
  // Загрузка сохраненных настроек
  chrome.storage.local.get(['apiKey', 'settings'], (data) => {
    document.getElementById('apiKey').value = data.apiKey || '';
    document.getElementById('errors').checked = data.settings?.errors ?? true;
    document.getElementById('performance').checked = data.settings?.performance ?? true;
    document.getElementById('network').checked = data.settings?.network ?? true;
  });

  // Сохранение настроек
  document.getElementById('save').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value;
    const settings = {
      errors: document.getElementById('errors').checked,
      performance: document.getElementById('performance').checked,
      network: document.getElementById('network').checked
    };

    chrome.storage.local.set({ apiKey, settings }, () => {
      alert('Настройки сохранены!11111111111111');
    });
  });
});