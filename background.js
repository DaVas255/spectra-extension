// Service Worker для фоновой обработки

const BUFFER_SIZE = 50; // Максимум событий перед отправкой
let eventBuffer = [];
let isSending = false;
const API_ENDPOINT = 'https://your-api.com/collect';

// 1. Получение сообщений от content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Добавляем контекст
  const enrichedEvent = {
    ...message.data,
    tabId: message.tabId,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    screenResolution: `${screen.width}x${screen.height}`
  };

  // Буферизация
  eventBuffer.push(enrichedEvent);

  // Отправка при заполнении буфера
  if (eventBuffer.length >= BUFFER_SIZE && !isSending) {
    flushBuffer();
  }

  // Локальное сохранение в IndexedDB
  saveToIndexedDB(enrichedEvent);

  sendResponse({ status: 'received' });
  return true;
});

// 2. Отправка данных на сервер
async function flushBuffer() {
  if (eventBuffer.length === 0 || isSending) return;

  isSending = true;
  const eventsToSend = [...eventBuffer];
  eventBuffer = [];

  try {
    const projectKey = await getProjectKey();

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Project-Key': projectKey
      },
      body: JSON.stringify({
        events: eventsToSend,
        batchId: Date.now()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Удаляем успешно отправленные из IndexedDB
    await clearSentFromIndexedDB(eventsToSend.map(e => e.id));

  } catch (error) {
    // Возвращаем в буфер при ошибке
    eventBuffer = [...eventsToSend, ...eventBuffer];

    // Экспоненциальная задержка для ретраев
    setTimeout(() => {
      isSending = false;
      if (eventBuffer.length > 0) {
        flushBuffer();
      }
    }, getRetryDelay());
  } finally {
    isSending = false;
  }
}

// 3. Работа с IndexedDB для офлайн1 поддержки
function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FrontendMonitorDB', 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('events')) {
        db.createObjectStore('events', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = reject;
  });
}

async function saveToIndexedDB(event) {
  const db = await initIndexedDB();
  const transaction = db.transaction('events', 'readwrite');
  const store = transaction.objectStore('events');

  event.id = `${Date.now()}-${Math.random()}`;
  store.add(event);
}

// 4. Периодическая отправка
setInterval(() => {
  if (eventBuffer.length > 0 && !isSending) {
    flushBuffer();
  }
}, 30000); // Каждые 30 секунд

// 5. При закрытии браузера
chrome.runtime.onSuspend.addListener(() => {
  if (eventBuffer.length > 0) {
    // Синхронная отправка (keepalive)
    navigator.sendBeacon(API_ENDPOINT, JSON.stringify(eventBuffer));
  }
});