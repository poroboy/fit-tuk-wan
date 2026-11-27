// App shell: boot, routing, header
import { initStore } from './store.js';
import { settings, profile, workoutLogs } from './data.js';
import { computeStreak, ymd } from './plan.js';
import { mountFigures, setBoardColors } from './figure.js';
import { flameSVG, toast } from './ui.js';
import { startReminderLoop, registerPeriodic, unlockAudio } from './notify.js';
import { showOnboarding } from './onboarding.js';
import { APP_VERSION, CHANGELOG } from './version.js';
import { meta, saveMeta } from './data.js';
import * as home from './pages/home.js';
import * as workout from './pages/workout.js';
import * as food from './pages/food.js';
import * as body from './pages/body.js';
import * as settingsPage from './pages/settings.js';

const routes = { home, workout, food, body, settings: settingsPage };
let currentName = null;

function current() {
  const h = location.hash.replace(/^#\/?/, '') || 'home';
  const [name] = h.split('/');
  return routes[name] ? name : 'home';
}

export function refresh(keepScroll = false) {
  const name = current();
  const page = routes[name];
  const view = document.getElementById('view');
  const y = window.scrollY;
  const changed = name !== currentName;
  currentName = name;
  view.innerHTML = page.render();
  const root = view.firstElementChild;
  if (keepScroll && !changed) root.style.animation = 'none';
  page.mount && page.mount(root);
  mountFigures(view);
  document.getElementById('pageTitle').textContent = page.title;
  document.getElementById('pageKicker').textContent = page.kicker ? page.kicker() : '';
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === name));
  updateStreak();
  if (keepScroll && !changed) window.scrollTo(0, y); else window.scrollTo(0, 0);
}

function updateStreak() {
  const n = computeStreak(workoutLogs(), settings(), ymd());
  const chip = document.getElementById('streakChip');
  chip.innerHTML = `${flameSVG(n)}<span>${n}</span>`;
  chip.setAttribute('aria-label', `ไฟติดต่อเนื่อง ${n} ครั้ง`);
}

export function applyTheme() {
  const t = settings().theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]').setAttribute('content', dark ? '#12100F' : '#FF5A36');
}

async function boot() {
  await initStore();
  setBoardColors(settings().boardColors);
  applyTheme();
  window.addEventListener('hashchange', () => refresh());
  document.getElementById('streakChip').addEventListener('click', () => {
    const n = computeStreak(workoutLogs(), settings(), ymd());
    toast(n ? `🔥 ไฟติด ${n} ครั้งติดต่อกัน อย่าให้ดับนะ!` : 'เล่นครั้งแรกเพื่อจุดไฟ 🔥');
  });
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  // re-render when the date changes (app left open overnight)
  let day = ymd();
  setInterval(() => { if (ymd() !== day) { day = ymd(); refresh(true); } }, 60000);
  refresh();
  if (!profile().setupDone) showOnboarding(() => refresh());
  startReminderLoop();
  registerSW();
  announceVersion();
}

// tell the user when the app just updated (and what changed)
function announceVersion() {
  const seen = meta().seenVersion;
  if (seen === APP_VERSION) return;
  saveMeta({ seenVersion: APP_VERSION });
  if (!profile().setupDone) return; // brand-new install: nothing to announce
  const c = CHANGELOG.find(x => x.v === APP_VERSION);
  setTimeout(() => toast(`🎉 อัปเดตเป็น v${APP_VERSION} แล้ว${c ? ' · ' + c.items[0] : ''}`, 5000), 1200);
}

let swReg = null, reloadOnChange = false;
export async function checkForUpdate() {
  if (!navigator.onLine) return 'offline';
  if (!swReg) { location.reload(); return 'updating'; }
  reloadOnChange = true;
  await swReg.update();
  if (swReg.installing || swReg.waiting) return 'updating';
  // no new service worker: still make sure the page itself is the newest copy
  try {
    const res = await fetch('js/version.js', { cache: 'no-store' });
    const m = (await res.text()).match(/APP_VERSION = '([^']+)'/);
    if (m && m[1] !== APP_VERSION) { setTimeout(() => location.reload(), 800); return 'updating'; }
  } catch { return 'offline'; }
  reloadOnChange = false;
  return 'latest';
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js', { type: 'module' });
    swReg = reg;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloadOnChange) location.reload(); });
    registerPeriodic();
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw && nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('มีเวอร์ชันใหม่ ปิดแล้วเปิดแอปใหม่เพื่ออัปเดต', 5000);
      });
    });
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'navigate') location.hash = e.data.url;
    });
  } catch (e) { console.warn('SW failed', e); }
}

boot();
