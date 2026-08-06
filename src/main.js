import { renderDashboard, renderStats, bindNavigation } from './ui.js';
import { subscribe } from './store.js';
import { flushSyncQueue } from './cloud.js';

const status = document.querySelector('#offline-status');
function updateConnection() {
  status.textContent = navigator.onLine ? 'online' : 'offline';
  status.setAttribute('aria-label', navigator.onLine ? 'Aplicativo online' : 'Aplicativo offline');
}

window.addEventListener('online', () => { updateConnection(); flushSyncQueue(); });
window.addEventListener('offline', updateConnection);
subscribe(renderStats);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(console.error));
}

updateConnection();
bindNavigation();
renderStats();
renderDashboard().catch(error => {
  document.querySelector('#view').innerHTML = `<div class="empty"><p>${error.message}</p></div>`;
});
