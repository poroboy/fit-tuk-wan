// Timed warm-up / cool-down routines (full-screen, voice guided)
import { EXERCISES } from './exercises.js';
import { figHTML, mountFigures, restartFigure } from './figure.js';
import { esc } from './ui.js';
import { beep, buzz, keepAwake, unlockAudio } from './notify.js';
import { speak } from './counter.js';
import { exerciseSheet } from './sheets.js';
import { fmtSec } from './timer.js';

export const ROUTINES = {
  warm: {
    title: 'วอร์มอัพ', icon: '🔥', done: 'อุ่นเครื่องเสร็จ พร้อมเล่นแล้ว!',
    why: 'อุ่นข้อต่อและกล้ามเนื้อ ลดโอกาสบาดเจ็บ และยกได้ดีขึ้นตั้งแต่เซ็ตแรก',
    items: [
      { exId: 'step_jack', sec: 60 },
      { exId: 'arm_circles', sec: 30, note: '15 วิแรกหมุนไปหน้า แล้วหมุนกลับ' },
      { exId: 'arm_swing', sec: 30 },
      { exId: 'torso_twist', sec: 30 },
      { exId: 'incline_pushup', sec: 30, note: 'ช้าๆ ประมาณ 10 ครั้ง ไม่ต้องให้เหนื่อย' },
    ],
  },
  cool: {
    title: 'คูลดาวน์ ยืดเหยียด', icon: '🧘', done: 'ยืดเสร็จแล้ว พักผ่อนให้เต็มที่!',
    why: 'ให้หัวใจเต้นช้าลง และช่วยคงความยืดหยุ่นของอก ไหล่ และแขนที่เล่นหนัก',
    items: [
      { exId: 'chest_stretch', sec: 30, perSide: true },
      { exId: 'triceps_stretch', sec: 30, perSide: true },
      { exId: 'shoulder_stretch', sec: 30, perSide: true },
      { exId: 'cobra', sec: 30 },
      { exId: 'child_pose', sec: 45 },
    ],
  },
};
const PREP = 4;     // seconds to get into position
const SWITCH = 4;   // seconds to change sides

export function routineSeconds(kind) {
  const r = ROUTINES[kind];
  return r.items.reduce((s, it) => s + it.sec * (it.perSide ? 2 : 1) + PREP + (it.perSide ? SWITCH : 0), 0);
}
export const routineMinutes = kind => Math.round(routineSeconds(kind) / 60 * 2) / 2;

let el = null, iv = null, st = null;

// onDone(completed: boolean)
export function openRoutine(kind, { onDone } = {}) {
  const r = ROUTINES[kind];
  unlockAudio();
  keepAwake(true);
  el = document.createElement('div');
  el.className = 'player';
  el.style.zIndex = 74;
  document.getElementById('overlay-root').appendChild(el);
  st = { kind, r, idx: 0, side: 1, phase: 'prep', endAt: 0, pausedLeft: null, onDone, finished: false };
  el.addEventListener('click', onClick);
  startItem(0);
}

function close(completed) {
  clearInterval(iv); iv = null;
  try { speechSynthesis.cancel(); } catch { /* ignore */ }
  keepAwake(false);
  if (el) { const old = el; old.classList.add('out'); setTimeout(() => old.remove(), 200); }
  el = null;
  const cb = st && st.onDone;
  st = null;
  cb && cb(completed);
}

function startItem(i) {
  st.idx = i; st.side = 1;
  setPhase('prep', PREP);
  const it = st.r.items[i];
  speak(`${i === 0 ? '' : 'ต่อไป '}${EXERCISES[it.exId].nameTh.replace(/\s*\(.*\)/, '')}`);
  draw();
}
function setPhase(phase, sec) {
  st.phase = phase;
  st.endAt = Date.now() + sec * 1000;
  st.total = sec;
  st.lastSec = null;
  clearInterval(iv);
  iv = setInterval(tick, 200);
}

function tick() {
  if (!st || st.pausedLeft != null) return;
  const left = Math.max(0, Math.ceil((st.endAt - Date.now()) / 1000));
  const it = st.r.items[st.idx];
  if (left !== st.lastSec) {
    st.lastSec = left;
    if (left <= 3 && left > 0) { beep('soft'); if (st.phase === 'go') speak(left); }
    const t = el && el.querySelector('[data-t]');
    if (t) t.textContent = fmtSec(left);
    const bar = el && el.querySelector('[data-bar]');
    if (bar) bar.style.width = `${(1 - left / st.total) * 100}%`;
  }
  if (left > 0) return;
  // phase finished
  if (st.phase === 'prep' || st.phase === 'switch') {
    setPhase('go', it.sec);
    beep('go'); buzz([120]);
    if (it.perSide) speak(`ข้างที่ ${st.side}`);
    const fig = el.querySelector('.fig'); if (fig) restartFigure(fig);
    draw();
  } else if (st.phase === 'go') {
    if (it.perSide && st.side === 1) {
      st.side = 2;
      setPhase('switch', SWITCH);
      beep('done'); speak('สลับข้าง');
      draw();
    } else if (st.idx + 1 < st.r.items.length) {
      beep('done');
      startItem(st.idx + 1);
    } else {
      clearInterval(iv);
      st.finished = true;
      beep('done'); buzz([200, 100, 200]);
      speak(st.r.done);
      drawDone();
    }
  }
}

function draw() {
  if (!el || !st) return;
  const it = st.r.items[st.idx];
  const ex = EXERCISES[it.exId];
  const n = st.r.items.length;
  const next = st.r.items[st.idx + 1];
  const left = Math.max(0, Math.ceil((st.endAt - Date.now()) / 1000));
  const phaseText = st.phase === 'prep' ? 'เตรียมท่า' : st.phase === 'switch' ? 'สลับข้าง!' : (it.perSide ? `ข้างที่ ${st.side}` : 'ทำต่อเนื่อง');
  el.innerHTML = `<div class="player-in">
    <div class="player-top"><button class="icon-btn" data-r="close" aria-label="ปิด">✕</button>
      <div class="grow">${st.r.icon} ${esc(st.r.title)} · ท่า ${st.idx + 1}/${n}</div><span class="chip">~${routineMinutes(st.kind)} นาที</span></div>
    <div class="progress"><i style="width:${(st.idx / n) * 100}%"></i></div>
    ${figHTML(it.exId, { label: true, view: ex.view || '' })}
    <div class="row between"><h2>${esc(ex.nameTh)}</h2><button class="icon-btn" data-r="info" aria-label="วิธีทำ">ⓘ</button></div>
    <div class="card center">
      <div class="small bold" style="color:${st.phase === 'go' ? 'var(--ok)' : 'var(--brand-ink)'}">${phaseText}</div>
      <div class="plank-big" data-t>${fmtSec(left)}</div>
      <div class="progress" style="margin-top:8px"><i data-bar style="width:0%;transition:width .2s linear"></i></div>
      ${it.note ? `<div class="small muted" style="margin-top:8px">${esc(it.note)}</div>` : ''}
      ${it.perSide ? `<div class="side-hint" style="margin-top:8px">↔️ ข้างละ ${it.sec} วิ แอปจะบอกเมื่อถึงเวลาสลับข้าง</div>` : ''}
    </div>
    ${next ? `<div class="small muted center">ต่อไป: ${esc(EXERCISES[next.exId].nameTh)}</div>` : ''}
    <div class="p-actions"><div class="grid2">
      <button class="btn" data-r="pause">${st.pausedLeft != null ? '▶ ต่อ' : '⏸ หยุดชั่วคราว'}</button>
      <button class="btn btn-soft" data-r="skip">ข้ามท่านี้ ⏭</button></div></div>
  </div>`;
  mountFigures(el);
}

function drawDone() {
  el.innerHTML = `<div class="player-in"><div class="celebrate" style="margin-top:12vh">
    <div style="font-size:64px">${st.r.icon}</div>
    <h2>${esc(st.r.done)}</h2>
    <p class="muted">${st.kind === 'warm' ? 'เริ่มเซ็ตแรกได้เลย' : 'อย่าลืมกินโปรตีนให้ถึงเป้า และนอน 7–8 ชม.'}</p>
    <button class="btn btn-primary btn-lg btn-block" data-r="finish">${st.kind === 'warm' ? 'ไปเล่นต่อ ▶' : 'เสร็จ'}</button>
  </div></div>`;
}

async function onClick(e) {
  const b = e.target.closest('[data-r]');
  if (!b || !st) return;
  const act = b.dataset.r;
  if (act === 'close') return close(false);
  if (act === 'finish') return close(true);
  if (act === 'info') return exerciseSheet(st.r.items[st.idx].exId);
  if (act === 'pause') {
    if (st.pausedLeft == null) { st.pausedLeft = st.endAt - Date.now(); try { speechSynthesis.cancel(); } catch { /* ignore */ } }
    else { st.endAt = Date.now() + st.pausedLeft; st.pausedLeft = null; }
    draw();
    return;
  }
  if (act === 'skip') {
    if (st.idx + 1 < st.r.items.length) startItem(st.idx + 1);
    else { clearInterval(iv); st.finished = true; drawDone(); }
  }
}
