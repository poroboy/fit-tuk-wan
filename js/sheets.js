// Shared sheets: exercise info, reps entry, plank timer, celebration
import { EXERCISES, MUSCLES } from './exercises.js';
import { toast } from './ui.js';
import { figHTML, boardDiagram } from './figure.js';
import { BOARD_COLOR_NAMES } from './figure.js';
import { openSheet, esc, stepperHTML, bindStepper, flameSVG, confetti, fmt } from './ui.js';
import { settings } from './data.js';
import { beep, buzz, keepAwake } from './notify.js';
import { fmtSec } from './timer.js';
import { sessionStats } from './session.js';
import { KIND_SHORT, isPerSide } from './plan.js';
import { openRoutine, routineMinutes } from './routine.js';
import { saveLog } from './data.js';

const BACKPACK = ['pushup', 'pushup_decline', 'pushup_wide', 'pushup_narrow'];

export function muscleChips(exId) {
  return EXERCISES[exId].muscles.map(m => `<span class="chip ${MUSCLES[m].cls}">${MUSCLES[m].name}</span>`).join('');
}

export function exerciseSheet(exId) {
  const ex = EXERCISES[exId];
  const s = settings();
  const boardNote = ex.board
    ? `<div class="card" style="background:var(--surface-2);box-shadow:none;padding:12px">
        <div class="small bold" style="margin-bottom:6px">เสียบด้ามจับที่ช่อง<span style="color:var(--brand-ink)">สี${BOARD_COLOR_NAMES[s.boardColors[ex.board]] || ''}</span> (${MUSCLES[ex.board].name})</div>
        ${boardDiagram(ex.board)}
        <div class="tiny muted" style="margin-top:4px">สีบนบอร์ดไม่ตรงกับของจริง? เปลี่ยนได้ที่ ตั้งค่า → บอร์ดวิดพื้น</div>
      </div>` : '';
  openSheet({
    title: esc(ex.nameTh),
    body: `<div class="col">
      ${figHTML(exId, { label: true, view: ex.view || 'มุมมองด้านข้าง' })}
      <div class="row wrap">${muscleChips(exId)}<span class="chip">${esc(ex.nameEn)}</span></div>
      <div><div class="field-label">วิธีทำ</div>
        <ol style="margin:6px 0 0;padding-left:20px">${ex.howTo.map(x => `<li style="margin:4px 0">${esc(x)}</li>`).join('')}</ol></div>
      ${ex.tips.length ? `<div class="alert ok"><span class="ai">💡</span><div>${ex.tips.map(esc).join('<br>')}</div></div>` : ''}
      ${ex.cautions.length ? `<div class="alert warn"><span class="ai">⚠️</span><div><b>จุดที่ต้องระวัง</b><br>${ex.cautions.map(esc).join('<br>')}</div></div>` : ''}
      ${boardNote}
    </div>`,
  });
}

export function repsSheet({ exId, setNo, totalSets, targetText, prefill, last, unitLabel = 'ครั้ง' }) {
  return new Promise(resolve => {
    let result = null;
    const ex = EXERCISES[exId];
    const perSide = isPerSide({ type: 'reps', text: targetText });
    const quick = [...new Set([prefill, last && last.reps, last && last.reps + 1, last && last.reps + 2].filter(v => v > 0))].slice(0, 4);
    const sheet = openSheet({
      title: `${esc(ex.nameTh)} · เซ็ต ${setNo}/${totalSets}`,
      body: `<div class="col">
        <div class="center muted small">เป้า: ${esc(targetText)}${last && last.reps ? ` · ครั้งก่อน ${last.reps}` : ''}</div>
        ${stepperHTML(prefill || 10, { step: 1, min: 0 })}
        <div class="center muted small">${perSide ? 'ครั้ง <b>ต่อข้าง</b> (สองข้างได้ไม่เท่ากัน ใส่ข้างที่น้อยกว่า)' : unitLabel}</div>
        ${quick.length ? `<div class="quick">${quick.map(v => `<button data-q="${v}">${v}${last && v > last.reps ? ' 🔥' : ''}</button>`).join('')}</div>` : ''}
        ${last && last.reps ? `<div class="alert info small"><span class="ai">🎯</span><div>พยายามทำให้ได้มากกว่าครั้งก่อน 1–2 ครั้ง</div></div>` : ''}
        ${BACKPACK.includes(exId) && last && last.best >= 25 ? `<div class="alert warn small"><span class="ai">🎒</span><div><b>วิดพื้นได้ ${last.best} ครั้งแล้ว</b> ลองใส่เป้ที่มีหนังสือหรือขวดน้ำ 3–5 กก. ให้กลับมาทำได้ราว 12–20 ครั้ง จะโตเร็วกว่าทำเยอะๆ</div></div>` : ''}
        <button class="btn btn-primary btn-lg btn-block" data-save>บันทึกเซ็ตนี้ ✓</button>
      </div>`,
      onClose: () => resolve(result),
      onMount: (el) => {
        const read = bindStepper(el);
        el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { el.querySelector('.stepper input').value = b.dataset.q; });
        el.querySelector('[data-save]').onclick = () => {
          result = { reps: Math.round(read()) };
          if (BACKPACK.includes(exId) && result.reps >= 25 && !(last && last.best >= 25)) setTimeout(() => toast('🎒 ได้ 25 ครั้งแล้ว! ครั้งหน้าลองวิดพื้นใส่เป้เพิ่มน้ำหนัก', 4500), 400);
          sheet.close();
        };
        setTimeout(() => { const i = el.querySelector('.stepper input'); i && i.select(); }, 350);
      },
    });
  });
}

// Plank stopwatch. Resolves seconds or null
export function plankSheet({ target, setNo, totalSets }) {
  return new Promise(resolve => {
    let result = null, t0 = null, iv = null, hit = false, elapsed = 0;
    const sheet = openSheet({
      title: `แพลงก์ · เซ็ต ${setNo}/${totalSets}`,
      body: `<div class="col">
        ${figHTML('plank', { label: true })}
        <div class="plank-big" data-time>0:00</div>
        <div class="center muted small">เป้า ${target} วินาที</div>
        <div class="progress"><i data-bar style="width:0%"></i></div>
        <div class="grid2">
          <button class="btn btn-primary btn-lg" data-start>เริ่ม ▶</button>
          <button class="btn btn-lg" data-stop disabled>หยุด ■</button>
        </div>
        <button class="btn btn-ghost" data-manual>ใส่เวลาเอง</button>
      </div>`,
      onClose: () => { clearInterval(iv); keepAwake(false); resolve(result); },
      onMount: (el) => {
        const timeEl = el.querySelector('[data-time]'), bar = el.querySelector('[data-bar]');
        const start = el.querySelector('[data-start]'), stop = el.querySelector('[data-stop]');
        start.onclick = () => {
          if (t0) return;
          beep('go'); keepAwake(true);
          t0 = Date.now(); start.disabled = true; stop.disabled = false;
          iv = setInterval(() => {
            elapsed = Math.floor((Date.now() - t0) / 1000);
            timeEl.textContent = fmtSec(elapsed);
            bar.style.width = Math.min(100, (elapsed / target) * 100) + '%';
            if (!hit && elapsed >= target) { hit = true; beep('done'); buzz([300, 100, 300]); timeEl.style.color = 'var(--ok)'; }
          }, 200);
        };
        stop.onclick = () => {
          clearInterval(iv);
          elapsed = Math.max(1, Math.floor((Date.now() - t0) / 1000));
          result = { seconds: elapsed };
          sheet.close();
        };
        el.querySelector('[data-manual]').onclick = () => {
          const v = prompt('ค้างได้กี่วินาที?', String(target));
          if (v && +v > 0) { result = { seconds: Math.round(+v) }; sheet.close(); }
        };
      },
    });
  });
}

export function celebrateSheet(log, streak) {
  const st = sessionStats(log);
  confetti();
  beep('done');
  const sh = openSheet({
    onMount: el => {
      const b = el.querySelector('[data-cool]');
      if (b) b.onclick = () => { sh.close(); openRoutine('cool', { onDone: done => { if (done) { log.cooldownDone = true; saveLog(log); } } }); };
    },
    body: `<div class="celebrate">
      ${flameSVG(streak)}
      <h2>เยี่ยมมาก! ไฟติด ${streak} 🔥</h2>
      <p class="muted">${KIND_SHORT[log.kind]}${log.week ? ` · สัปดาห์ ${log.week}` : ''}${log.makeupFor ? ' · เล่นชดเชย' : ''}</p>
      <div class="tiles" style="width:100%;margin-top:6px">
        <div class="tile"><small>จำนวนครั้งรวม</small><b>${fmt(st.reps)}</b><span>ครั้ง</span></div>
        <div class="tile"><small>น้ำหนักรวมที่ยก</small><b>${fmt(st.volume)}</b><span>กก.</span></div>
        <div class="tile"><small>วิดพื้นสูงสุด</small><b>${fmt(st.maxPush)}</b><span>ครั้ง/เซ็ต</span></div>
        <div class="tile"><small>เผาผลาญประมาณ</small><b>${fmt(log.kcalBurned)}</b><span>kcal · ${log.durationMin} นาที</span></div>
      </div>
      <div class="alert ok" style="width:100%;text-align:left"><span class="ai">🥚</span><div>อย่าลืมกินโปรตีนภายในวันนี้ให้ถึงเป้า และนอนให้ได้ 7–8 ชม.</div></div>
      ${log.cooldownDone ? '' : `<button class="btn btn-primary btn-block btn-lg" data-cool>🧘 ยืดเหยียดคูลดาวน์ (~${routineMinutes('cool')} นาที)</button>`}
      <button class="btn ${log.cooldownDone ? 'btn-primary' : ''} btn-block btn-lg" data-close>${log.cooldownDone ? 'เสร็จ' : 'ข้าม เสร็จเลย'}</button>
    </div>`,
  });
}
