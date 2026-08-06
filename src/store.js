import { APP_CONFIG } from './config.js';

const initialState = () => ({
  version: 1,
  xp: 0,
  streak: 0,
  answered: 0,
  correct: 0,
  lastStudyDate: null,
  reviews: {},
  errors: [],
  dontKnow: [],
  syncQueue: []
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(APP_CONFIG.storageKey));
    return { ...initialState(), ...(parsed || {}) };
  } catch {
    return initialState();
  }
}

function persist() {
  localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(state));
  listeners.forEach(listener => listener(getState()));
}

export function getState() { return structuredClone(state); }
export function setState(patch) { state = { ...state, ...patch }; persist(); }
export function updateState(updater) { state = updater(getState()); persist(); }
export function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function resetState() { state = initialState(); persist(); }
