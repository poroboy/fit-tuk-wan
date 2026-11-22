// Rest timer (floating pill). Uses end timestamps so it stays accurate in background.
import { beep, buzz, showNotif } from './notify.js';
import { esc } from './ui.js';

let state = null; // { endAt, total, label, next, onDone, ticked }
let iv = null;
const listeners = new Set();
export const onTimer = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const restState = () => state;
const emit = () => listeners.forEach(fn => fn(state));

export function startRest(sec, { label = 'พัก', next = '', onDone = null, silentPill = false } = {}) {
  state = { endAt: Date.now() + sec * 1000, total: sec, label, next, onDone, silentPill, beeped: new Set() };
  clearInterval(iv);
  iv = setInterval(tick, 250);
  tick();
  render();
}
export function addRest(sec) {
  if (!state) return;
  state.endAt += sec * 1000;
  state.total = Math.max(state.total + sec, 1);
  tick();
}
export function stopRest(finished = false) {
  const s = state;
  state = null;
  clearInterval(iv);
  render();
  emit();
  if (finished && s && s.onDone) s.onDone();
}
export const remaining = () => (state ? Math.max(0, Math.ceil((state.endAt - Date.now()) / 1000)) : 0);

function tick() {
  if (!state) return;
  const left = remaining();
  if (left <= 3 && left > 0 && !state.beeped.has(left)) { state.beeped.add(left); beep('tick'); }
  if (left <= 0) {
    beep('done');
    buzz([300, 120, 300]);
    if (document.visibilityState !== 'visible') showNotif('หมดเวลาพัก ⏱️', state.next ? `ต่อไป: ${state.next}` : 'ไปเซ็ตต่อไปกันเลย', { tag: 'rest' });
    const pill = document.querySelector('.timer-pill');
    if (pill) pill.classList.add('ding');
    setTimeout(() => stopRest(true), pill ? 900 : 0);
    clearInterval(iv);
    emit();
    return;
  }
  updatePill(left);
  emit();
}

function render() {
  const root = document.getElementById('timer-root');
  if (!root) return;
  if (!state || state.silentPill) { root.innerHTML = ''; return; }
  root.innerHTML = `<div class="timer-pill" role="timer">
    <div class="t" data-t>${fmtSec(remaining())}</div>
    <div class="grow"><small>${esc(state.label)}</small><b>${state.next ? 'ต่อไป: ' + esc(state.next) : 'พักให้หายเหนื่อย'}</b></div>
    <button data-add>+15</button><button data-skip>ข้าม</button>
    <div class="prog"><i data-prog style="width:100%"></i></div>
  </div>`;
  root.querySelector('[data-add]').onclick = () => addRest(15);
  root.querySelector('[data-skip]').onclick = () => stopRest(true);
}
function updatePill(left) {
  const t = document.querySelector('.timer-pill [data-t]');
  if (t) t.textContent = fmtSec(left);
  const p = document.querySelector('.timer-pill [data-prog]');
  if (p && state) p.style.width = `${(left / state.total) * 100}%`;
}
export const fmtSec = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export function hidePill(hide) {
  if (state) { state.silentPill = hide; render(); }
}
