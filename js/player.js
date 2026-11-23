// Guided workout player (full screen)
import { workoutLogs } from './data.js';
import { EXERCISES } from './exercises.js';
import { figHTML, mountFigures, restartFigure } from './figure.js';
import { createCounter, speak } from './counter.js';
import { esc, confirmDialog } from './ui.js';
import { steps, getSet, nextStep, progress, markSet, finishSession, restAfter, lastReps } from './session.js';
import { repsSheet, plankSheet, celebrateSheet, exerciseSheet, muscleChips } from './sheets.js';
import { startRest, stopRest, addRest, onTimer, remaining, restState, hidePill, fmtSec } from './timer.js';
import { keepAwake, unlockAudio, beep } from './notify.js';
import { PHASES, isPerSide, SIDE_HINT } from './plan.js';
import { refresh } from './app.js';

let el = null, logId = null, unsub = null, screen = 'ex';
let counter = null; // active rep counter

const getLog = () => workoutLogs().find(l => l.id === logId);

export function openPlayer(id) {
  logId = id;
  unlockAudio();
  keepAwake(true);
  if (!el) {
    el = document.createElement('div');
    el.className = 'player';
    document.getElementById('overlay-root').appendChild(el);
    el.addEventListener('click', onClick);
  }
  screen = restState() ? 'rest' : 'ex';
  hidePill(true);
  unsub = onTimer(st => {
    if (!el) return;
    if (!st && screen === 'rest') { screen = 'ex'; beep('go'); draw(); return; }
    if (st && screen === 'rest') updateRing();
  });
  draw();
  history.pushState({ player: 1 }, '');
  window.addEventListener('popstate', onPop);
}
function onPop() { closePlayer(true); }

export function closePlayer(fromPop = false) {
  if (!el) return;
  stopCounter();
  window.removeEventListener('popstate', onPop);
  if (!fromPop && history.state && history.state.player) history.back();
  unsub && unsub();
  keepAwake(false);
  hidePill(false);
  el.classList.add('out');
  const old = el;
  el = null;
  setTimeout(() => old.remove(), 200);
  refresh(true);
}

function header(log) {
  const pr = progress(log);
  const st = nextStep(log);
  let pos = '';
  if (st) {
    pos = log.mode === 'full'
      ? `รอบ ${st.setIdx + 1}/${log.plan[st.exIdx].sets} · ท่า ${st.exIdx + 1}/${log.plan.length}`
      : `ท่า ${st.exIdx + 1}/${log.plan.length} · เซ็ต ${st.setIdx + 1}/${log.plan[st.exIdx].sets}`;
  }
  return `<div class="player-top"><button class="icon-btn" data-a="close" aria-label="ปิด">✕</button><div class="grow">${pos}</div><span class="chip">${pr.done}/${pr.total}</span></div>
    <div class="progress"><i style="width:${(pr.pct * 100).toFixed(0)}%"></i></div>`;
}

function draw() {
  const log = getLog();
  if (!log) { closePlayer(); return; }
  if (screen === 'rest' && restState()) return drawRest(log);
  const st = nextStep(log);
  if (!st) { closePlayer(); return; }
  const p = log.plan[st.exIdx];
  const ex = EXERCISES[p.exId];
  const last = lastReps(p.exId, st.setIdx, log.id);
  const prevSet = st.setIdx > 0 ? getSet(log, st.exIdx, st.setIdx - 1) : null;
  const phase = PHASES.find(x => x.n === log.phase) || PHASES[0];
  el.innerHTML = `<div class="player-in">
    ${header(log)}
    ${figHTML(p.exId, { label: true, view: ex.view || '' })}
    <div>
      <div class="row between"><h2>${esc(ex.nameTh)}</h2><button class="icon-btn" data-a="info" aria-label="วิธีทำ">ⓘ</button></div>
      <div class="row wrap" style="margin-top:4px">${muscleChips(p.exId)}</div>
    </div>
    <div class="card">
      <div class="p-target ${String(p.text).length > 8 && p.type !== 'time' ? 'long' : ''}"><b>${p.type === 'time' ? p.seconds + ' วิ' : esc(p.text)}</b><span class="muted">${p.type === 'time' ? 'ค้างไว้' : isPerSide(p) ? 'ครั้ง/ข้าง' : 'ครั้ง'}</span></div>
      ${isPerSide(p) ? `<div class="side-hint" style="margin:6px 0 2px">↔️ ${SIDE_HINT}</div>` : ''}
      <div class="small muted">${last ? `ครั้งก่อน: ${last.reps != null ? last.reps + ' ครั้ง' : last.seconds + ' วิ'}` : 'ครั้งแรกของท่านี้'}${prevSet && prevSet.reps ? ` · เซ็ตที่แล้ว ${prevSet.reps}` : ''}</div>
      <div class="small" style="margin-top:6px">📌 ${esc(phase.note)}${log.deload ? ' · สัปดาห์เบา ใช้แรงครึ่งเดียว' : ''}</div>
    </div>
    <div class="p-actions">
      ${p.type === 'time'
        ? `<button class="btn btn-primary btn-lg btn-block" data-a="plank">⏱️ เริ่มจับเวลาแพลงก์</button>`
        : `<button class="btn btn-primary btn-lg btn-block" data-a="count">🔢 นับให้${p.target ? ` ${p.target} ครั้ง${isPerSide(p) ? '/ข้าง' : ''}` : ' (ทำจนเกือบหมดแรง)'}</button>
           <button class="btn btn-soft btn-block" data-a="done">ทำเองแล้ว ใส่จำนวนครั้ง ✓</button>`}
      <div class="grid2"><button class="btn" data-a="skip">ข้ามเซ็ตนี้</button><button class="btn" data-a="finish">จบวันนี้</button></div>
    </div>
  </div>`;
  mountFigures(el);
}

function drawRest(log) {
  const rs = restState();
  const nxt = nextStep(log);
  const p = nxt ? log.plan[nxt.exIdx] : null;
  const size = 230, stroke = 16, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  el.innerHTML = `<div class="player-in">
    ${header(log)}
    <div class="rest-screen">
      <div class="muted bold">${esc(rs.label)}</div>
      <div class="rest-ring">
        <svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${stroke}"/>
        <circle class="bar" data-c="${c}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#restGrad)"stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="0" style="transition:stroke-dashoffset .25s linear"/>
        <defs><linearGradient id="restGrad" x1="0" x2="1"><stop offset="0" stop-color="#FF5A36"/><stop offset="1" stop-color="#FF2E63"/></linearGradient></defs></svg>
        <div class="lbl"><b data-t>${fmtSec(remaining())}</b><small>พัก</small></div>
      </div>
      <div class="grid3" style="width:100%"><button class="btn" data-a="minus">−15</button><button class="btn" data-a="plus">+15</button><button class="btn btn-primary" data-a="skiprest">ไปต่อ ▶</button></div>
      ${p ? `<div class="card next-card">${figHTML(p.exId, { small: true })}<div class="grow"><div class="tiny muted">ต่อไป</div><b>${esc(EXERCISES[p.exId].nameTh)}</b><div class="small muted">${log.mode === 'full' ? 'รอบ' : 'เซ็ต'} ${nxt.setIdx + 1} · ${p.type === 'time' ? p.seconds + ' วิ' : esc(p.text)}</div></div></div>` : ''}
      <div class="small muted center">💧 จิบน้ำ หายใจลึกๆ</div>
    </div>
  </div>`;
  mountFigures(el);
  updateRing();
}

function updateRing() {
  if (!el) return;
  const rs = restState();
  const t = el.querySelector('[data-t]');
  const bar = el.querySelector('.rest-ring .bar');
  if (!rs || !t || !bar) return;
  const left = remaining();
  t.textContent = fmtSec(left);
  const c = +bar.dataset.c;
  bar.style.strokeDashoffset = String(c * (1 - left / rs.total));
}

async function onClick(e) {
  const a = e.target.closest('[data-a]');
  if (!a) return;
  const log = getLog();
  const act = a.dataset.a;
  if (act === 'close') return closePlayer();
  if (act === 'info') { const st = nextStep(log); if (st) exerciseSheet(log.plan[st.exIdx].exId); return; }
  if (act === 'plus') return addRest(15);
  if (act === 'minus') { if (remaining() > 16) addRest(-15); else stopRest(true); return; }
  if (act === 'skiprest') return stopRest(true);
  if (act === 'finish') {
    const pr = progress(log);
    if (!pr.done) { if (await confirmDialog('ยังไม่ได้ทำเลย ปิดโหมดนำเล่นไหม?', { ok: 'ปิด' })) closePlayer(); return; }
    if (!(await confirmDialog(`ทำไป ${pr.done}/${pr.total} เซ็ต จบวันนี้เลยไหม?`, { ok: 'จบเลย' }))) return;
    stopRest();
    const { streak } = finishSession(log);
    closePlayer();
    celebrateSheet(log, streak);
    return;
  }
  const st = nextStep(log);
  if (!st) return;
  const p = log.plan[st.exIdx];
  if (act === 'count') return startCount(log, st, p);
  if (act === 'cstop') { const r = stopCounter(); return saveSet(log, st, p, { prefill: r ? r.reps : null }); }
  if (act === 'ccancel') { stopCounter(); draw(); return; }
  let res = null;
  if (act === 'skip') res = { reps: 0 };
  else if (act === 'plank') res = await plankSheet({ target: p.seconds, setNo: st.setIdx + 1, totalSets: p.sets });
  else if (act === 'done') return saveSet(log, st, p, {});
  if (!res || !el) return;
  afterSet(log, st, res);
}

// ask for the reps (prefilled from the counter if it ran), then save
async function saveSet(log, st, p, { prefill = null }) {
  const last = lastReps(p.exId, st.setIdx, log.id);
  const prev = st.setIdx > 0 ? getSet(log, st.exIdx, st.setIdx - 1) : null;
  const res = await repsSheet({ exId: p.exId, setNo: st.setIdx + 1, totalSets: p.sets, targetText: p.text, prefill: prefill != null ? prefill : (prev && prev.reps) || (last && last.reps) || p.target || 10, last });
  if (!res || !el) { if (el) draw(); return; }
  afterSet(log, st, res);
}

function afterSet(log, st, res) {
  const { allDone } = markSet(log, st.exIdx, st.setIdx, res);
  if (allDone) {
    const { streak } = finishSession(log);
    closePlayer();
    celebrateSheet(log, streak);
    return;
  }
  const rest = restAfter(log, st.exIdx, st.setIdx);
  if (rest) {
    startRest(rest.sec, { label: rest.label, next: rest.next, silentPill: true });
    screen = 'rest';
  }
  draw();
}

// ---------- rep counter ----------
function stopCounter() {
  if (!counter) return null;
  const r = counter.stop();
  counter = null;
  return r;
}

function startCount(log, st, p) {
  stopCounter();
  const fig = el.querySelector('.fig');
  const actions = el.querySelector('.p-actions');
  if (!fig || !actions) return;
  const perSide = isPerSide(p);
  const ov = document.createElement('div');
  ov.className = 'count-ov';
  ov.innerHTML = `<b data-cn>3</b><span data-cl>เตรียมตัว</span>${perSide ? '<em data-cs>ข้างที่ 1</em>' : ''}`;
  fig.appendChild(ov);
  actions.innerHTML = `<button class="btn btn-ok btn-lg btn-block" data-a="cstop">✓ เสร็จ / หยุดนับ</button>
    <button class="btn btn-block" data-a="ccancel">ยกเลิกการนับ</button>
    <p class="tiny muted center">${p.target ? `นับถึง ${p.target}${perSide ? ' ต่อข้าง แล้วบอกให้สลับข้าง' : ''} แล้วหยุดเอง` : 'นับไปเรื่อยๆ กดหยุดเมื่อเกือบหมดแรง'} · ทำตามจังหวะตัวการ์ตูนได้เลย</p>`;
  const cn = ov.querySelector('[data-cn]'), cl = ov.querySelector('[data-cl]'), cs = ov.querySelector('[data-cs]');
  counter = createCounter({
    exId: p.exId,
    target: p.target || null,
    perSide,
    onStart: () => restartFigure(fig),
    onUpdate: u => {
      const big = u.phase === 'count' ? u.rep : u.big;
      if (cn.textContent !== String(big)) { cn.textContent = big; cn.classList.remove('pop'); void cn.offsetWidth; cn.classList.add('pop'); }
      cl.textContent = u.phase === 'count' ? (u.label || 'ทำต่อ') + (u.target ? ` · เป้า ${u.target}` : '') : u.label;
      ov.classList.toggle('wait', u.phase !== 'count');
      if (cs) cs.textContent = `ข้างที่ ${u.side}`;
    },
    onFinish: r => {
      counter = null;
      setTimeout(() => { if (el) saveSet(log, st, p, { prefill: r.reps }); }, 700);
    },
  });
}
