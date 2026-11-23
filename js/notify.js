// Notifications, sounds, vibration, calendar reminders
import { get, set } from './store.js';
import { settings, profile, workoutLogs, foodLogs, bodyLogs } from './data.js';
import { dueReminders } from './reminders.js';
import { PHASES, addDays, mondayOf, ymd, weekday } from './plan.js';
import { toast } from './ui.js';

export const notifSupported = () => 'Notification' in window;
export const notifPermission = () => (notifSupported() ? Notification.permission : 'unsupported');

export async function requestNotif() {
  if (!notifSupported()) return 'unsupported';
  const r = await Notification.requestPermission();
  if (r === 'granted') registerPeriodic();
  return r;
}

export async function showNotif(title, body, { tag, url = '#/home' } = {}) {
  if (notifPermission() !== 'granted') return false;
  const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', vibrate: [200, 100, 200], data: { url } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title, opts); return true; }
    new Notification(title, opts);
    return true;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

export async function registerPeriodic() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (!reg || !('periodicSync' in reg)) return false;
    const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (st.state !== 'granted') return false;
    await reg.periodicSync.register('reminders', { minInterval: 60 * 60 * 1000 });
    return true;
  } catch { return false; }
}

// ---------- in-app reminder loop ----------
function checkReminders() {
  const ctx = { settings: settings(), profile: profile(), workoutLogs: workoutLogs(), foodLogs: foodLogs(), bodyLogs: bodyLogs() };
  const due = dueReminders(ctx);
  if (!due.length) return;
  const notified = { ...get('notified', {}) };
  let changed = false;
  for (const r of due) {
    if (notified[r.key]) continue;
    notified[r.key] = Date.now();
    changed = true;
    if (notifPermission() === 'granted') showNotif(r.title, r.body, { tag: r.key, url: r.url });
    else if (document.visibilityState === 'visible') toast(`${r.title}`, 4000);
  }
  if (changed) {
    // keep only recent keys
    const cutoff = Date.now() - 40 * 86400000;
    for (const k of Object.keys(notified)) if (notified[k] < cutoff) delete notified[k];
    set('notified', notified);
  }
}
export function startReminderLoop() {
  setTimeout(checkReminders, 4000);
  setInterval(checkReminders, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkReminders(); });
}

// ---------- sound & vibration ----------
let actx = null;
export function unlockAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch { /* ignore */ }
}
export function beep(kind = 'tick') {
  if (!settings().sound) return;
  try {
    unlockAudio();
    const seq = kind === 'done' ? [[880, 0, 0.16], [1175, 0.2, 0.16], [1568, 0.4, 0.32]]
      : kind === 'go' ? [[660, 0, 0.12], [990, 0.15, 0.25]]
        : kind === 'up' ? [[988, 0, 0.12]]
          : kind === 'soft' ? [[520, 0, 0.07]]
            : [[740, 0, 0.09]];
    for (const [f, t, d] of seq) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t0 = actx.currentTime + t;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g).connect(actx.destination);
      o.start(t0); o.stop(t0 + d + 0.05);
    }
  } catch { /* ignore */ }
}
export function buzz(pattern = [200, 100, 200]) {
  if (!settings().vibrate) return;
  try { navigator.vibrate && navigator.vibrate(pattern); } catch { /* ignore */ }
}

// ---------- wake lock ----------
let wakeLock = null;
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    } else if (!on && wakeLock) {
      await wakeLock.release(); wakeLock = null;
    }
  } catch { /* ignore */ }
}

// ---------- Google Calendar / ICS ----------
const pad = n => String(n).padStart(2, '0');
const stamp = (date, hhmm) => `${date.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
function endTime(hhmm, addMin) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = h * 60 + m + addMin;
  return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
}
function firstOnOrAfter(date, wd) {
  let d = date;
  for (let i = 0; i < 7; i++) { if (weekday(d) === wd) return d; d = addDays(d, 1); }
  return date;
}

export function calendarEvents(s = settings()) {
  const start = s.startDate < ymd() ? mondayOf(ymd()) : s.startDate;
  const splitStart = addDays(s.startDate, (PHASES[3].from - 1 + (s.weekOffset || 0)) * 7);
  const t = s.reminderTime || '19:00';
  const ev = [];
  if (splitStart > start) {
    ev.push({
      id: 'full', title: 'ออกกำลังกาย 💪 (ชุดรวม)', date: firstOnOrAfter(start, 1), time: t, dur: 40,
      rrule: `FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=${addDays(splitStart, -1).replace(/-/g, '')}T235959`,
      desc: 'เปิดแอปฟิตทุกวัน แล้วกดเริ่มเล่น',
    });
  }
  ev.push({
    id: 'split', title: 'ออกกำลังกาย 💪 (ชุด A/B)', date: firstOnOrAfter(splitStart > start ? splitStart : start, 1), time: t, dur: 40,
    rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,TH,FR', desc: 'จ+พฤ = ชุด A · อ+ศ = ชุด B',
  });
  ev.push({ id: 'weigh', title: 'ชั่งน้ำหนัก ⚖️', date: firstOnOrAfter(ymd(), 1), time: '07:00', dur: 10, rrule: 'FREQ=WEEKLY;BYDAY=MO', desc: 'ชั่งตอนเช้าหลังตื่นนอน แล้วบันทึกในแอป' });
  const now = new Date();
  const nextFirst = `${now.getFullYear() + (now.getMonth() === 11 ? 1 : 0)}-${pad(((now.getMonth() + 1) % 12) + 1)}-01`;
  ev.push({ id: 'measure', title: 'วัดรอบตัว + ถ่ายรูป 📏', date: nextFirst, time: '09:00', dur: 15, rrule: 'FREQ=MONTHLY;BYMONTHDAY=1', desc: 'รอบแขน (เกร็ง) อก เอว ไหล่ + รูปท่าเดิม แสงเดิม' });
  return ev;
}

export function gcalLink(e) {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${stamp(e.date, e.time)}/${stamp(e.date, endTime(e.time, e.dur))}`,
    details: e.desc,
    recur: `RRULE:${e.rrule}`,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function icsText(events) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//fit-tuk-wan//TH', 'CALSCALE:GREGORIAN'];
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.id}-${e.date}@fit-tuk-wan`, `DTSTAMP:${now}`,
      `DTSTART:${stamp(e.date, e.time)}`, `DTEND:${stamp(e.date, endTime(e.time, e.dur))}`,
      `RRULE:${e.rrule}`, `SUMMARY:${e.title}`, `DESCRIPTION:${e.desc}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${e.title}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
