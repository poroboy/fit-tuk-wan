// Small UI helpers
import { mountFigures } from './figure.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n, d = 0) => (Number.isFinite(+n) ? (+n).toLocaleString('th-TH', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '–');
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

export function toast(msg, ms = 2400) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, ms);
}

// Bottom sheet. Returns { el, close }
export function openSheet({ title = '', body = '', onMount, onClose, wide = false } = {}) {
  const root = document.getElementById('overlay-root');
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const sheet = document.createElement('div');
  sheet.className = 'sheet' + (wide ? ' wide' : '');
  sheet.setAttribute('role', 'dialog');
  sheet.innerHTML = `<div class="grab"></div>${title ? `<div class="sheet-h"><h3>${title}</h3><button class="icon-btn" data-close aria-label="ปิด">✕</button></div>` : ''}<div class="sheet-body">${body}</div>`;
  root.append(scrim, sheet);
  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    scrim.classList.add('out'); sheet.classList.add('out');
    setTimeout(() => { scrim.remove(); sheet.remove(); }, 230);
    onClose && onClose(result);
  };
  scrim.addEventListener('click', () => close());
  sheet.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  // swipe down to close
  let y0 = null;
  sheet.querySelector('.grab').addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchmove', e => {
    if (y0 == null) return;
    const dy = e.touches[0].clientY - y0;
    if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  sheet.addEventListener('touchend', e => {
    if (y0 == null) return;
    const dy = e.changedTouches[0].clientY - y0;
    y0 = null;
    if (dy > 90) close(); else sheet.style.transform = '';
  });
  const api = { el: sheet, close };
  mountFigures(sheet);
  onMount && onMount(sheet, api);
  return api;
}

export function confirmDialog(msg, { ok = 'ตกลง', cancel = 'ยกเลิก', danger = false } = {}) {
  return new Promise(resolve => {
    let answered = false;
    const s = openSheet({
      body: `<div class="col"><p style="font-size:16px;font-weight:600">${msg}</p>
        <div class="grid2"><button class="btn" data-no>${cancel}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${ok}</button></div></div>`,
      onClose: () => { if (!answered) resolve(false); },
    });
    s.el.querySelector('[data-yes]').onclick = () => { answered = true; resolve(true); s.close(); };
    s.el.querySelector('[data-no]').onclick = () => { answered = true; resolve(false); s.close(); };
  });
}

// ---------- flame ----------
export function flameSVG(streak, cls = '') {
  const lit = streak > 0;
  const grad = streak >= 20 ? 'flameGradBlue' : 'flameGrad';
  return `<svg class="flame ${lit ? 'lit' : 'off'} ${cls}" viewBox="0 0 32 40" aria-hidden="true">
    <path class="fo" fill="url(#${grad})" d="M16 1.5c2 8 12 12.5 12 23.5 0 8-5.6 13.5-12 13.5S4 33 4 25c0-6 4-9 6-14 1 4 3 6 4.2 6C13.4 11 14 6 16 1.5z"/>
    <path class="fi" fill="#FFE59A" d="M16 17.5c1 5 6 7 6 12.5 0 4-2.8 6.5-6 6.5s-6-2.5-6-6.5c0-3 2-5 3-8 1 2.4 2 3.4 2.6 3.4C15.2 22 15.5 19.8 16 17.5z"/>
  </svg>`;
}

// ---------- ring ----------
export function ringSVG(value, target, color, { size = 132, stroke = 13 } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const over = target > 0 && value > target * 1.05;
  return `<svg viewBox="0 0 ${size} ${size}">
    <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
    <circle class="bar" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${over ? 'var(--warn)' : color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${c.toFixed(1)}" data-offset="${(c * (1 - pct)).toFixed(1)}"/>
  </svg>`;
}
// animate rings from 0 after render
export function animateRings(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('.ring .bar, .rest-ring .bar', root).forEach(b => { if (b.dataset.offset) b.style.strokeDashoffset = b.dataset.offset; });
    $$('.bar-mini i[data-w]', root).forEach(b => { b.style.width = b.dataset.w; });
  }));
}

export function confetti(n = 60) {
  const box = document.createElement('div');
  box.className = 'confetti';
  const cols = ['#FF5A36', '#FF2E63', '#FFC93C', '#18A06A', '#7457F5', '#1E90F0'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = cols[i % cols.length];
    p.style.animationDuration = 1.6 + Math.random() * 1.6 + 's';
    p.style.animationDelay = Math.random() * 0.4 + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3800);
}

export function stepperHTML(value, { step = 1, min = 0, unit = '' } = {}) {
  return `<div class="stepper" data-step="${step}" data-min="${min}">
    <button type="button" data-dec aria-label="ลด">−</button>
    <input type="number" inputmode="decimal" value="${value}" step="${step}" min="${min}" aria-label="จำนวน">
    <button type="button" data-inc aria-label="เพิ่ม">+</button>
  </div>${unit ? `<div class="center muted small">${unit}</div>` : ''}`;
}
export function bindStepper(root, onChange) {
  const st = $('.stepper', root);
  if (!st) return () => 0;
  const input = $('input', st);
  const step = +st.dataset.step, min = +st.dataset.min;
  const setV = v => { input.value = +Math.max(min, v).toFixed(2); onChange && onChange(+input.value); };
  $('[data-dec]', st).onclick = () => setV((+input.value || 0) - step);
  $('[data-inc]', st).onclick = () => setV((+input.value || 0) + step);
  input.oninput = () => onChange && onChange(+input.value || 0);
  return () => +input.value || 0;
}

export function download(name, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
