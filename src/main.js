import { requireAccess } from './access-gate.js';
import { renderDashboard, renderStats, bindNavigation } from './ui.js';
import { subscribe } from './store.js';
import { flushSyncQueue } from './cloud.js';
import { initAnninha } from './anninha-pet.js';

async function boot() {
  await requireAccess();

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
  initAnninha();
  renderDashboard().catch(error => {
    document.querySelector('#view').innerHTML = `<div class="empty"><p>${error.message}</p></div>`;
  });
}

boot().catch(error => {
  console.error('PetroQuest boot error', error);
});
