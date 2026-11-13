// Datenspeicher: alles bleibt lokal auf dem Gerät (IndexedDB).
// Es gibt keinen Server und keine Übertragung von Daten.

import { defaultCategories, mergeCategories } from './categories.js';

const DB_NAME = 'zyklus-app';
const DB_VERSION = 1;
const FALLBACK_KEY = 'zyklus-app-fallback';

export const state = {
  entries: new Map(), // 'YYYY-MM-DD' -> { date, v: { catId: { o:[], i, n } }, note }
  settings: null,
  storage: 'indexeddb',
};

export function defaultSettings() {
  return {
    version: 1,
    categories: defaultCategories(),
    cycle: { defaultCycle: 28, defaultPeriod: 5, luteal: 14 },
    theme: 'auto',
    lastBackup: null,
    created: new Date().toISOString(),
  };
}

let db = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('entries')) d.createObjectStore('entries', { keyPath: 'date' });
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run(storeName, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const req = fn(t.objectStore(storeName));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function normalizeSettings(s) {
  const d = defaultSettings();
  if (!s || typeof s !== 'object') return d;
  return {
    ...d,
    ...s,
    cycle: { ...d.cycle, ...(s.cycle || {}) },
    categories: mergeCategories(s.categories),
  };
}

export async function loadState() {
  try {
    db = await openDb();
    const [entries, settings] = await Promise.all([
      run('entries', 'readonly', (s) => s.getAll()),
      run('meta', 'readonly', (s) => s.get('settings')),
    ]);
    state.entries = new Map((entries || []).map((e) => [e.date, e]));
    state.settings = normalizeSettings(settings);
  } catch (err) {
    console.warn('IndexedDB nicht verfügbar, nutze localStorage', err);
    db = null;
    state.storage = 'localstorage';
    let data = {};
    try { data = JSON.parse(localStorage.getItem(FALLBACK_KEY) || '{}'); } catch { /* leer */ }
    state.entries = new Map((data.entries || []).map((e) => [e.date, e]));
    state.settings = normalizeSettings(data.settings);
  }
}

function saveFallback() {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify({
      entries: [...state.entries.values()],
      settings: state.settings,
    }));
  } catch (e) { console.error(e); }
}

export function hasValue(val) {
  if (!val) return false;
  if (Array.isArray(val.o) && val.o.length) return true;
  return val.n !== undefined && val.n !== null && val.n !== '' && !Number.isNaN(val.n);
}

/** Entfernt leere Werte; gibt null zurück, wenn der Eintrag ganz leer ist. */
export function cleanEntry(entry) {
  const v = {};
  for (const [k, val] of Object.entries(entry.v || {})) {
    if (!hasValue(val)) continue;
    const c = {};
    if (Array.isArray(val.o) && val.o.length) c.o = [...val.o];
    if (val.i) c.i = val.i;
    if (hasValue({ n: val.n })) c.n = Number(val.n);
    v[k] = c;
  }
  const note = (entry.note || '').trim() ? entry.note : '';
  if (!Object.keys(v).length && !note) return null;
  return { date: entry.date, v, note };
}

export async function saveEntry(entry) {
  const clean = cleanEntry(entry);
  if (clean) state.entries.set(entry.date, clean);
  else state.entries.delete(entry.date);
  if (!db) return saveFallback();
  await run('entries', 'readwrite', (s) => (clean ? s.put(clean) : s.delete(entry.date)));
  requestPersistence();
}

export async function saveEntries(list) {
  for (const e of list) {
    const clean = cleanEntry(e);
    if (clean) state.entries.set(e.date, clean);
    else state.entries.delete(e.date);
  }
  if (!db) return saveFallback();
  await run('entries', 'readwrite', (s) => {
    for (const e of list) {
      const clean = state.entries.get(e.date);
      if (clean) s.put(clean); else s.delete(e.date);
    }
  });
  requestPersistence();
}

export async function saveSettings() {
  if (!db) return saveFallback();
  await run('meta', 'readwrite', (s) => s.put(structuredClone(state.settings), 'settings'));
}

export async function replaceAll({ entries, settings }) {
  state.entries = new Map((entries || []).map(cleanEntry).filter(Boolean).map((e) => [e.date, e]));
  state.settings = normalizeSettings(settings);
  if (!db) return saveFallback();
  await run('entries', 'readwrite', (s) => {
    s.clear();
    for (const e of state.entries.values()) s.put(e);
  });
  await saveSettings();
}

export async function clearAll() {
  await replaceAll({ entries: [], settings: null });
}

let persistAsked = false;
function requestPersistence() {
  if (persistAsked) return;
  persistAsked = true;
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}

export function exportData() {
  return {
    app: 'zyklus-app',
    format: 1,
    exported: new Date().toISOString(),
    settings: state.settings,
    entries: [...state.entries.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function getCategory(id) {
  return state.settings.categories.find((c) => c.id === id);
}
