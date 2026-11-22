// IndexedDB key-value store with an in-memory cache.
// Safe to import from the service worker (no DOM access).
const DB_NAME = 'fitness-super-app';
const DB_VER = 1;
let dbp = null;

export function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}

const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = t => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = t.onabort = () => rej(t.error); });

export async function kvGet(key) {
  const db = await openDB();
  return req(db.transaction('kv').objectStore('kv').get(key));
}
export async function kvSet(key, val) {
  const db = await openDB();
  const t = db.transaction('kv', 'readwrite');
  t.objectStore('kv').put(val, key);
  return done(t);
}
export async function kvAll() {
  const db = await openDB();
  const s = db.transaction('kv').objectStore('kv');
  const [keys, vals] = await Promise.all([req(s.getAllKeys()), req(s.getAll())]);
  const o = {};
  keys.forEach((k, i) => { o[k] = vals[i]; });
  return o;
}

// ---------- cache ----------
const cache = {};
export async function initStore() {
  Object.assign(cache, await kvAll());
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* ignore */ }
}
export function get(key, fallback) {
  return cache[key] !== undefined ? cache[key] : fallback;
}
export function set(key, value) {
  cache[key] = value;
  return kvSet(key, value).catch(err => console.error('save failed', key, err));
}

// ---------- photos ----------
export async function photoPut(photo) {
  const db = await openDB();
  const t = db.transaction('photos', 'readwrite');
  t.objectStore('photos').put(photo);
  return done(t);
}
export async function photoAll() {
  const db = await openDB();
  const all = await req(db.transaction('photos').objectStore('photos').getAll());
  return all.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
export async function photoDelete(id) {
  const db = await openDB();
  const t = db.transaction('photos', 'readwrite');
  t.objectStore('photos').delete(id);
  return done(t);
}

// ---------- backup ----------
export async function exportAll() {
  return {
    app: 'fitness-super-app',
    version: 1,
    exportedAt: new Date().toISOString(),
    kv: Object.fromEntries(Object.entries(cache).filter(([k]) => k !== 'secrets')), // API keys never leave the device
    photos: await photoAll(),
  };
}
export async function importAll(data) {
  if (!data || data.app !== 'fitness-super-app' || typeof data.kv !== 'object') {
    throw new Error('ไฟล์ไม่ถูกต้อง');
  }
  const keepSecrets = cache.secrets;
  await clearAll();
  const db = await openDB();
  const t = db.transaction(['kv', 'photos'], 'readwrite');
  const kv = t.objectStore('kv');
  for (const [k, v] of Object.entries(data.kv)) if (k !== 'secrets') kv.put(v, k);
  if (keepSecrets) kv.put(keepSecrets, 'secrets');
  const ph = t.objectStore('photos');
  for (const p of data.photos || []) ph.put(p);
  await done(t);
  for (const k of Object.keys(cache)) delete cache[k];
  Object.assign(cache, data.kv);
  delete cache.secrets;
  if (keepSecrets) cache.secrets = keepSecrets;
}
export async function clearAll() {
  const db = await openDB();
  const t = db.transaction(['kv', 'photos'], 'readwrite');
  t.objectStore('kv').clear();
  t.objectStore('photos').clear();
  await done(t);
  for (const k of Object.keys(cache)) delete cache[k];
}
