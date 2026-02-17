// Основной скрипт, который внедряется на каждую страницу

// 1. Перехват глобальных ошибок
window.addEventListener('error', (event) => {
  const errorData = {
    type: 'ERROR',
    timestamp: Date.now(),
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack,
    url: window.location.href
  };

  sendToBackground('error', errorData);
});

// 2. Перехват Promise rejections
window.addEventListener('unhandledrejection', (event) => {
  sendToBackground('promise-rejection', {
    reason: event.reason?.toString(),
    stack: event.reason?.stack
  });
});

// 3. Перехват console.error
const originalConsoleError = console.error;
console.error = function (...args) {
  originalConsoleError.apply(console, args);
  sendToBackground('console-error', {
    args: args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ),
    stack: new Error().stack
  });
};

// 4. Сбор метрик производительности
function collectPerformanceMetrics() {
  const perfData = performance.getEntriesByType('navigation')[0];

  return {
    dns: perfData.domainLookupEnd - perfData.domainLookupStart,
    tcp: perfData.connectEnd - perfData.connectStart,
    ssl: perfData.connectEnd - perfData.secureConnectionStart,
    ttfb: perfData.responseStart - perfData.requestStart,
    download: perfData.responseEnd - perfData.responseStart,
    domInteractive: perfData.domInteractive,
    domComplete: perfData.domComplete,
    loadEvent: perfData.loadEventEnd
  };
}

// 5. Мониторинг ресурсов
const observer = new PerformanceObserver((list) => {
  list.getEntries().forEach(entry => {
    if (entry.initiatorType === 'script' || entry.initiatorType === 'link') {
      sendToBackground('resource-error', {
        name: entry.name,
        duration: entry.duration,
        initiatorType: entry.initiatorType,
        transferSize: entry.transferSize
      });
    }
  });
});
observer.observe({ entryTypes: ['resource'] });

// 6. Коммуникация с background script
function sendToBackground(type, data) {
  chrome.runtime.sendMessage({
    type: type,
    data: data,
    tabId: chrome.devtools.inspectedWindow.tabId,
    url: window.location.href
  });
}

// 7. Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  // Отправляем начальные метрики
  setTimeout(() => {
    sendToBackground('performance', collectPerformanceMetrics());
  }, 2000);
});