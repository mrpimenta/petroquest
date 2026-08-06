import { updateState } from './store.js';

export function enqueueSync(event) {
  updateState(state => ({ ...state, syncQueue: [...state.syncQueue, { ...event, queuedAt: new Date().toISOString() }] }));
}

export async function flushSyncQueue() {
  // A integração Supabase será ativada apenas depois da criação do projeto e das políticas RLS.
  return { synced: 0, pending: true };
}
