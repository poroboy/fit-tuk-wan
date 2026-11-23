// Service worker: offline cache + background reminders (module worker)
import { kvGet, kvSet } from './js/store.js';
import { dueReminders } from './js/reminders.js';
import { mergeSettings } from './js/data.js';

const VERSION = 'v1.1.0';
const CACHE = `fit-${VERSION}`;
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/store.js', './js/data.js', './js/plan.js', './js/exercises.js', './js/figure.js',
  './js/foods.js', './js/nutrition.js', './js/reminders.js', './js/insights.js', './js/ui.js', './js/charts.js',
  './js/notify.js', './js/timer.js', './js/session.js', './js/sheets.js', './js/player.js', './js/onboarding.js', './js/ai.js', './js/counter.js', './js/suggest.js',
  './js/pages/home.js', './js/pages/workout.js', './js/pages/food.js', './js/pages/body.js', './js/pages/settings.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/badge-96.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // fonts: cache-first
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // app shell: network-first (fresh when online), fall back to cache offline
  e.respondWith((async () => {
    try {
      const res = await (req.mode === 'navigate' ? fetch(req) : fetch(req, { cache: 'no-cache' }));
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('./index.html');
      throw new Error('offline');
    }
  })());
});

// ---------- background reminders (Chrome periodic background sync) ----------
async function runReminders() {
  const [settings, profile, workoutLogs, foodLogs, bodyLogs, notified] = await Promise.all(
    ['settings', 'profile', 'workoutLogs', 'foodLogs', 'bodyLogs', 'notified'].map(k => kvGet(k)));
  if (!profile || !profile.setupDone) return;
  const ctx = { settings: mergeSettings(settings || {}), profile, workoutLogs: workoutLogs || [], foodLogs: foodLogs || [], bodyLogs: bodyLogs || [] };
  const due = dueReminders(ctx, new Date());
  const seen = { ...(notified || {}) };
  let changed = false;
  for (const r of due) {
    if (seen[r.key]) continue;
    seen[r.key] = Date.now();
    changed = true;
    await self.registration.showNotification(r.title, { body: r.body, tag: r.key, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', data: { url: r.url } });
  }
  if (changed) await kvSet('notified', seen);
}
self.addEventListener('periodicsync', e => {
  if (e.tag === 'reminders') e.waitUntil(runReminders());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '#/home';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { c.postMessage({ type: 'navigate', url }); return c.focus(); }
    }
    return self.clients.openWindow('./' + url);
  })());
});
