import { settings, saveSettings, workoutLogs, deleteLog, meta } from '../data.js';
import { ymd, addDays, mondayOf, dayInfo, KIND_NAMES, KIND_SHORT, DAY_SHORT, thaiDate, isComplete, computeStreak, weekProgress, dateStatus, parseYmd, prescription, roadmap, DAYS_TEXT, isPerSide, SIDE_HINT } from '../plan.js';
import { EXERCISES, LIGHT_DB_TRICKS, HEALTH_NOTES } from '../exercises.js';
import { figHTML } from '../figure.js';
import { esc, fmt, confirmDialog, openSheet, toast } from '../ui.js';
import { activeSession, lastCompletedOn, createSession, markSet, unmarkSet, getSet, progress, finishSession, sessionStats, lastReps, restAfter, todayChoice, nextStep } from '../session.js';
import { exerciseSheet, repsSheet, plankSheet, celebrateSheet, muscleChips } from '../sheets.js';
import { startRest } from '../timer.js';
import { lineChart, barChart } from '../charts.js';
import { openPlayer } from '../player.js';
import { openRoutine, ROUTINES, routineMinutes } from '../routine.js';
import { saveLog, saveMeta } from '../data.js';
import { refresh } from '../app.js';

export const title = 'ออกกำลังกาย';
let tab = 'today';
let kindOverride = null; // A/B swap on split days

export function kicker() {
  const info = dayInfo(ymd(), settings());
  return info.prestart ? 'ก่อนเริ่มแผน' : `สัปดาห์ที่ ${info.week} · ช่วง ${info.phase.n}`;
}

export function weekStripHTML(showProtein = false, proteinFn = null) {
  const s = settings(), today = ymd(), logs = workoutLogs();
  const mon = mondayOf(today);
  let out = '<div class="week">';
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    const { st, info } = dateStatus(d, s, logs, today);
    const label = st === 'done' || st === 'extra' ? '✓' : st === 'miss' ? '✕' : st === 'plan' ? (info.kind || '') : '·';
    out += `<div class="wd ${d === today ? 'today' : ''}"><span class="d">${DAY_SHORT[parseYmd(d).getDay()]}</span>
      <span class="st ${st}">${label}</span>
      ${showProtein ? `<span class="pdot ${proteinFn && proteinFn(d) ? 'on' : ''}" title="โปรตีนถึงเป้า"></span>` : `<span class="n">${parseYmd(d).getDate()}</span>`}</div>`;
  }
  return out + '</div>';
}

function planHeader(info) {
  const s = settings();
  if (info.prestart) {
    return `<div class="card hero">
      <div class="card-sub">แผนเริ่ม ${thaiDate(s.startDate)}</div>
      <h2 style="font-size:22px;margin:4px 0 6px">อีก ${info.daysToStart} วันเริ่มแผน 🚀</h2>
      <p class="card-sub">ระหว่างนี้ซ้อมท่าก่อนได้ (นับเป็นการเล่นนอกตาราง)</p>
      ${nextChangeHTML(true)}
    </div>`;
  }
  const ph = info.phase;
  return `<div class="card hero">
    <div class="row between"><span class="chip">ช่วง ${ph.n}/5 · ${esc(ph.name)}</span>${info.deload ? '<span class="chip">🌙 สัปดาห์เบา</span>' : ''}</div>
    <h2 style="font-size:22px;margin:8px 0 2px">สัปดาห์ที่ ${info.week}</h2>
    <p class="card-sub">${ph.mode === 'full' ? 'จ · พ · ศ' : 'จ(A) · อ(B) · พฤ(A) · ศ(B)'} · ${info.deload ? 2 : ph.sets} รอบ/เซ็ต · ${esc(ph.reps)} ครั้ง · แพลงก์ ${ph.plankText} วิ</p>
    <p style="margin-top:8px;font-weight:600">📌 ${esc(ph.note)}${info.deload ? ' · สัปดาห์นี้ลดเหลือ 2 รอบ ใช้แรงประมาณครึ่งเดียว' : ''}</p>
    ${nextChangeHTML(true)}
  </div>`;
}

const phaseSummary = p => `${p.days} วัน/สัปดาห์ · ${p.sets} ${p.mode === 'full' ? 'รอบ' : 'เซ็ต'} · ${esc(p.reps)} ครั้ง · แพลงก์ ${p.plankText} วิ`;

function nextChangeHTML(onHero = false) {
  const rm = roadmap(settings(), ymd());
  const n = rm.next;
  if (!n) return '';
  const when = n.inWeeks <= 1 ? 'สัปดาห์หน้า' : `อีก ${n.inWeeks} สัปดาห์`;
  let text;
  if (n.kind === 'phase') {
    const cur = rm.info.prestart ? null : rm.info.phase;
    const changes = [];
    if (!cur || n.phase.days !== cur.days) changes.push(`เล่น ${n.phase.days} วัน/สัปดาห์`);
    if (!cur || n.phase.sets !== cur.sets) changes.push(`${n.phase.sets} ${n.phase.mode === 'full' ? 'รอบ' : 'เซ็ต'}`);
    if (!cur || n.phase.reps !== cur.reps) changes.push(`${n.phase.reps} ครั้ง`);
    if (!cur || n.phase.plankText !== cur.plankText) changes.push(`แพลงก์ ${n.phase.plankText} วิ`);
    changes.push(n.phase.note);
    text = `<b>${when}</b> (${thaiDate(n.date, { weekday: false })}) เข้าช่วง ${n.phase.n} ${esc(n.phase.name)}: ${esc(changes.join(' · '))}`;
  } else if (n.kind === 'deload') {
    text = `<b>${when}</b> (${thaiDate(n.date, { weekday: false })}) เป็นสัปดาห์เบา 🌙 เหลือ 2 รอบ ใช้แรงครึ่งเดียว ให้ร่างกายฟื้นตัว`;
  } else {
    text = `<b>สัปดาห์หน้า</b> (${thaiDate(n.date, { weekday: false })}) กลับมาเล่นเต็มเหมือนเดิม`;
  }
  return onHero
    ? `<div style="margin-top:10px;padding:9px 11px;border-radius:12px;background:rgba(255,255,255,.18);font-size:13.5px">⏭️ ${text}</div>`
    : `<div class="alert info"><span class="ai">⏭️</span><div>${text}</div></div>`;
}

function roadmapHTML(open = false) {
  const rm = roadmap(settings(), ymd());
  const rows = rm.phases.map(p => `<li class="rm ${p.state}">
      <span class="rm-dot">${p.state === 'past' ? '✓' : p.n}</span>
      <div class="grow">
        <div class="row between"><b>ช่วง ${p.n} · ${esc(p.name)}</b>${p.state === 'now' ? '<span class="chip brand">ตอนนี้</span>' : ''}</div>
        <div class="small muted">สัปดาห์ ${p.from}${Number.isFinite(p.to) ? `–${p.to}` : '+'} · ${thaiDate(p.start, { weekday: false })}${p.end ? ` – ${thaiDate(p.end, { weekday: false })}` : ' เป็นต้นไป'}</div>
        <div class="small">${DAYS_TEXT[p.mode]} · ${phaseSummary(p)}</div>
        <div class="small" style="color:var(--brand-ink)">📌 ${esc(p.note)}</div>
      </div></li>`).join('');
  return `<details class="card roadmap" ${open ? 'open' : ''}>
    <summary class="card-h" style="margin:0"><h3>🗺️ แผนของคุณ</h3><span class="card-sub">${rm.info.prestart ? 'เริ่ม ' + thaiDate(settings().startDate, { weekday: false }) : `สัปดาห์ ${rm.week} · ช่วง ${rm.info.phase.n}/5`}</span></summary>
    <div class="col" style="margin-top:10px">
      ${nextChangeHTML()}
      <ol class="rm-list">${rows}</ol>
      <div class="small muted">🌙 สัปดาห์ที่ 8, 16, 24… เป็นสัปดาห์เบา (2 รอบ แรงครึ่งเดียว) · ถ้าสัปดาห์ไหนเพิ่มจำนวนครั้งไม่ได้ กด "อยู่ช่วงเดิมต่อ" แผนจะเลื่อนออกไป 1 สัปดาห์</div>
      <div class="alert ok small"><span class="ai">📈</span><div><b>ระหว่างช่วงเดียวกัน</b> ให้พยายามเพิ่มทีละ 1–2 ครั้งต่อท่าทุกสัปดาห์ แอปจะโชว์ยอดครั้งก่อนตอนบันทึกเซ็ตให้เทียบ</div></div>
    </div>
  </details>`;
}

function exCard(log, p, exIdx, plan) {
  const ex = EXERCISES[p.exId];
  const allDone = log && Array.from({ length: p.sets }, (_, k) => getSet(log, exIdx, k)).every(x => x && x.done);
  const nxt = log ? nextStep(log) : { exIdx: 0, setIdx: 0 };
  let dots = '';
  for (let k = 0; k < p.sets; k++) {
    const st = log ? getSet(log, exIdx, k) : null;
    const isNext = nxt && nxt.exIdx === exIdx && nxt.setIdx === k;
    const val = st && st.done ? (st.reps != null ? st.reps : st.seconds != null ? st.seconds + 'วิ' : '') : '';
    dots += `<button class="set-dot ${st && st.done ? 'done' : ''} ${isNext ? 'next' : ''}" data-act="set" data-ex="${exIdx}" data-set="${k}" aria-label="${plan.mode === 'full' ? 'รอบ' : 'เซ็ต'} ${k + 1}">
      ${st && st.done ? '<span class="chk">✓</span>' : k + 1}${val !== '' ? `<span class="rep">${val}</span>` : ''}</button>`;
  }
  const current = !allDone && nxt && nxt.exIdx === exIdx;
  return `<div class="card ex-card ${allDone ? 'done' : ''} ${current ? 'current' : ''}">${current ? '<span class="now-tag">ทำท่านี้</span>' : ''}
    <button style="border:0;padding:0;background:none" data-act="info" data-id="${p.exId}" aria-label="ดูวิธีทำ">${figHTML(p.exId, { small: true })}</button>
    <div class="ex-body">
      <button class="ex-name" data-act="info" data-id="${p.exId}">${esc(ex.nameTh)}</button>
      <div class="row wrap" style="gap:6px">${muscleChips(p.exId)}</div>
      <div class="ex-target">${p.sets} ${plan.mode === 'full' ? 'รอบ' : 'เซ็ต'} × ${esc(p.text)}</div>
      ${isPerSide(p) ? `<div class="side-hint">↔️ ${SIDE_HINT}</div>` : ''}
      <div class="sets">${dots}</div><div class="sets-gap"></div>
    </div>
  </div>`;
}

function todayHTML() {
  const s = settings(), date = ymd();
  const choice = todayChoice(date);
  const info = choice.info;
  let log = activeSession(date);
  const done = lastCompletedOn(date);
  let html = planHeader(info);
  html += `<div class="card"><div class="card-h"><h3>สัปดาห์นี้</h3><span class="card-sub">${(() => { const w = weekProgress(workoutLogs(), s, date); return `เล่นแล้ว ${w.done}/${w.planned}`; })()}</span></div>${weekStripHTML()}</div>`;

  if (!log && done) {
    const st = sessionStats(done);
    html += `<div class="card" style="background:var(--ok-soft)">
      <div class="row"><div style="font-size:34px">🏆</div><div class="grow"><h3>วันนี้เล่นเสร็จแล้ว!</h3>
      <p class="small muted">${KIND_SHORT[done.kind]} · ${fmt(st.reps)} ครั้ง · ${fmt(st.volume)} กก. · ${done.durationMin || '-'} นาที</p></div></div>
      <div class="row" style="margin-top:10px"><button class="btn btn-sm" data-act="view" data-id="${done.id}">ดูรายละเอียด</button>
      <button class="btn btn-sm btn-ghost" data-act="again">เล่นอีกชุด</button></div></div>`;
    html += routineCard('cool', done.cooldownDone);
    return html + extrasHTML(info);
  }

  let kind, opts = {};
  if (log) { kind = log.kind; }
  else if (choice.rest) {
    const ph = info.phase;
    html += `<div class="card"><div class="row"><div style="font-size:36px">😴</div><div class="grow"><h3>วันนี้วันพัก</h3>
      <p class="small muted">กล้ามโตตอนพัก กินโปรตีนให้ถึงเป้าและนอน 7–8 ชม.</p></div></div>
      ${choice.missed ? `<button class="btn btn-primary btn-block" style="margin-top:12px" data-act="makeup" data-date="${choice.missed.date}">ขาดวัน${DAY_SHORT[parseYmd(choice.missed.date).getDay()]}ก่อน? เล่นวันนี้แทน (${KIND_SHORT[ph.mode === 'full' ? 'F' : choice.kind]})</button>`
        : `<button class="btn btn-soft btn-block" style="margin-top:12px" data-act="extra">อยากเล่นเพิ่ม? เล่น${KIND_SHORT[choice.kind]}นอกตาราง</button>`}
    </div>`;
    return html + extrasHTML(info);
  } else {
    kind = kindOverride && info.phase.mode === 'split' ? kindOverride : choice.kind;
    if (choice.practice) opts.practice = true;
  }

  const items = log ? log.plan : prescription(kind, info.phase, info.deload);
  const plan = { mode: log ? log.mode : info.phase.mode, plan: items };
  const pr = log ? progress(log) : { done: 0, total: items.reduce((a, p) => a + p.sets, 0), pct: 0 };
  html += `<div class="card">
    <div class="card-h"><div><h3>${esc(KIND_NAMES[kind])}</h3>
      <div class="card-sub">${items.length} ท่า · ${plan.mode === 'full' ? 'ทำครบทุกท่า = 1 รอบ แล้วพัก 1–2 นาที' : 'ทำท่าละ ' + items[0].sets + ' เซ็ต พัก 45–60 วิ'}</div></div>
      ${!log && info.phase.mode === 'split' && !choice.practice ? `<div class="seg" style="width:96px"><button class="${kind === 'A' ? 'on' : ''}" data-act="kind" data-k="A">A</button><button class="${kind === 'B' ? 'on' : ''}" data-act="kind" data-k="B">B</button></div>` : ''}
    </div>
    <div class="progress"><i style="width:${(pr.pct * 100).toFixed(0)}%"></i></div>
    <div class="row between small muted" style="margin-top:6px"><span>${pr.done}/${pr.total} เซ็ต</span>${log && log.makeupFor ? '<span class="chip warn">เล่นชดเชย</span>' : ''}${choice.practice ? '<span class="chip">ซ้อมก่อนเริ่มแผน</span>' : ''}</div>
    <button class="btn btn-primary btn-lg btn-block" style="margin-top:12px" data-act="play" data-kind="${kind}">${log && pr.done ? '▶ เล่นต่อ (โหมดนำเล่น)' : '▶ เริ่มเล่น (โหมดนำเล่น)'}</button>
    <p class="tiny muted center" style="margin-top:6px">หรือแตะวงกลมด้านล่างเพื่อติ๊กทีละเซ็ต</p>
  </div>`;
  html += routineCard('warm', log && log.warmupDone);
  html += guideBanner(log, items, plan.mode);
  html += items.map((p, i) => exCard(log, p, i, plan)).join('');
  html += routineCard('cool', log && log.cooldownDone);
  if (log && pr.done) html += `<button class="btn btn-ok btn-block btn-lg" data-act="finish">จบการออกกำลังกายวันนี้ ✓</button>`;
  if (log) html += `<button class="btn btn-ghost" data-act="discard" data-id="${log.id}">ยกเลิกการเล่นครั้งนี้</button>`;
  return html + extrasHTML(info);
}

export function routineCard(kind, done) {
  const r = ROUTINES[kind];
  done = !!done || meta()[`${kind}Date`] === ymd();
  return `<div class="card routine-card ${done ? 'done' : ''}">
    <div class="row"><div class="rt-ico">${r.icon}</div>
      <div class="grow"><b>${r.title} ${done ? '✓' : ''}</b><div class="small muted">${r.items.length} ท่า · ~${routineMinutes(kind)} นาที · ${kind === 'warm' ? 'ทำก่อนเล่น' : 'ทำหลังเล่นเสร็จ'}</div></div>
      <button class="btn ${done ? 'btn-soft' : 'btn-primary'} btn-sm" data-act="routine" data-k="${kind}">${done ? 'ทำอีกครั้ง' : '▶ เริ่ม'}</button></div>
    <div class="rt-moves">${r.items.map(it => `<button class="chip" data-act="info" data-id="${it.exId}">${EXERCISES[it.exId].nameTh.replace(/\s*\(.*\)/, '')}${it.perSide ? ' ↔️' : ''}</button>`).join('')}</div>
  </div>`;
}

// "what to do now" guide above the exercise list
function guideBanner(log, items, mode) {
  const st = log ? nextStep(log) : { exIdx: 0, setIdx: 0 };
  if (!st) return '';
  const name = EXERCISES[items[st.exIdx].exId].nameTh;
  const total = items[st.exIdx].sets;
  if (mode === 'full') {
    const nextName = st.exIdx + 1 < items.length ? EXERCISES[items[st.exIdx + 1].exId].nameTh : null;
    return `<div class="guide">
      <div class="guide-round">${Array.from({ length: total }, (_, r) => `<i class="${r < st.setIdx ? 'past' : r === st.setIdx ? 'now' : ''}"></i>`).join('')}</div>
      <div><b>🔁 ตอนนี้รอบ ${st.setIdx + 1}/${total} · ท่า ${st.exIdx + 1}/${items.length}</b>
      <div class="small">ทำ<b>${esc(name)}</b> 1 เซ็ต (${esc(items[st.exIdx].type === 'time' || !/\d/.test(items[st.exIdx].text) ? items[st.exIdx].text : items[st.exIdx].text + ' ครั้ง')}) ${isPerSide(items[st.exIdx]) ? ' <b>ข้างแรก แล้วสลับข้างทันที</b> ครบ 2 ข้าง' : ''} แล้วกดวงกลมเลข <b>${st.setIdx + 1}</b> → ${nextName ? `ไปท่าถัดไป (${esc(nextName)})` : 'จบรอบ พัก 1–2 นาที แล้ววนกลับไปเริ่มท่าแรก'}</div>
      <div class="tiny muted" style="margin-top:2px">ทำครบทุกท่าท่าละ 1 เซ็ต = 1 รอบ แล้ววนกลับมาเริ่มใหม่จนครบ ${total} รอบ</div></div>
    </div>`;
  }
  return `<div class="guide"><div><b>💪 ท่า ${st.exIdx + 1}/${items.length} · เซ็ต ${st.setIdx + 1}/${total}</b>
    <div class="small">ทำ<b>${esc(name)}</b> ให้ครบ ${total} เซ็ตก่อน (พักระหว่างเซ็ต 45–60 วิ) แล้วค่อยไปท่าถัดไป</div>
    ${isPerSide(items[st.exIdx]) ? `<div class="tiny" style="margin-top:2px">↔️ 1 เซ็ต = ข้างแรกครบ แล้วสลับข้างทันที ครบ 2 ข้างค่อยกด</div>` : ''}</div></div>`;
}

function extrasHTML(info) {
  let h = roadmapHTML(false) + `<details class="more"><summary>💡 ทริคดัมเบลเบา (4.5 กก.)</summary><ul>${LIGHT_DB_TRICKS.map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>`;
  h += `<details class="more"><summary>⚠️ ข้อควรระวังด้านสุขภาพ</summary><ul>${HEALTH_NOTES.map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>`;
  if (!info.prestart) h += `<button class="btn btn-ghost" data-act="stay">สัปดาห์นี้เพิ่มจำนวนครั้งไม่ได้เลย? อยู่ช่วงเดิมต่อ 1 สัปดาห์</button>`;
  return h;
}

// ---------- stats ----------
function statsHTML() {
  const s = settings(), today = ymd(), logs = workoutLogs();
  const done = logs.filter(isComplete);
  const streak = computeStreak(logs, s, today);
  const best = Math.max(meta().bestStreak || 0, streak);
  const w = weekProgress(logs, s, today);
  const stats = done.map(l => ({ l, st: sessionStats(l) }));
  const maxPush = Math.max(0, ...stats.map(x => x.st.maxPush));
  let html = `<div class="tiles">
    <div class="tile"><small>สัปดาห์นี้</small><b>${w.done}/${w.planned}</b><span>ครั้ง</span></div>
    <div class="tile"><small>เล่นทั้งหมด</small><b>${done.length}</b><span>ครั้ง</span></div>
    <div class="tile"><small>สตรีค 🔥</small><b>${streak}</b><span>สูงสุด ${best}</span></div>
    <div class="tile"><small>วิดพื้นสูงสุด</small><b>${maxPush}</b><span>ครั้ง/เซ็ต</span></div>
  </div>`;
  html += roadmapHTML(true);
  const recent = stats.slice(-14);
  if (recent.length >= 1) {
    const pts = recent.map((x, i) => ({ x: i, y: x.st.pushReps }));
    const maxPts = recent.map((x, i) => ({ x: i, y: x.st.maxPush }));
    html += `<div class="card"><div class="card-h"><h3>วิดพื้นต่อครั้งที่เล่น</h3><span class="card-sub">${recent.length} ครั้งล่าสุด</span></div>
      ${lineChart([{ points: pts, color: 'var(--brand)', dots: true, label: true }, { points: maxPts, color: 'var(--protein)', width: 2, dots: true }], { decimals: 0, yPad: 2, xLabels: [{ x: 0, label: thaiDate(recent[0].l.date, { weekday: false }) }, { x: recent.length - 1, label: thaiDate(recent[recent.length - 1].l.date, { weekday: false }) }] })}
      <div class="legend"><span><i style="background:var(--brand)"></i>รวมทุกเซ็ต</span><span><i style="background:var(--protein)"></i>มากสุดใน 1 เซ็ต</span></div></div>`;
  }
  // weekly volume, last 8 weeks
  const mon = mondayOf(today);
  const bars = [];
  for (let i = 7; i >= 0; i--) {
    const ws = addDays(mon, -7 * i), we = addDays(ws, 6);
    const v = stats.filter(x => x.l.date >= ws && x.l.date <= we).reduce((a, x) => a + x.st.volume, 0);
    bars.push({ label: thaiDate(ws, { weekday: false }).replace(/\s.*/, '') + '/' + (parseYmd(ws).getMonth() + 1), value: Math.round(v), highlight: i === 0 });
  }
  html += `<div class="card"><div class="card-h"><h3>Volume รวมต่อสัปดาห์</h3><span class="card-sub">กก. (ครั้ง × น้ำหนัก)</span></div>
    ${bars.some(b => b.value > 0) ? barChart(bars) + '<p class="tiny muted">ยิ่งแท่งสูงขึ้นทุกสัปดาห์ = ร่างกายได้รับงานมากขึ้น กล้ามโตต่อเนื่อง</p>' : '<div class="empty"><span class="e">📊</span>ยังไม่มีข้อมูล เล่นเสร็จ 1 ครั้งแล้วกราฟจะขึ้น<br><span class="small">Volume = จำนวนครั้ง × น้ำหนักที่ยก รวมทั้งสัปดาห์</span></div>'}</div>`;
  html += `<div class="card"><div class="card-h"><h3>ประวัติ</h3></div>`;
  if (!done.length) html += `<div class="empty"><span class="e">🏋️</span>ยังไม่มีประวัติ เริ่มเล่นครั้งแรกกันเลย</div>`;
  else html += [...stats].reverse().slice(0, 40).map(({ l, st }) => `<button class="hist-row" data-act="view" data-id="${l.id}">
      <span class="hist-badge ${l.kind}">${l.kind}</span>
      <div class="grow"><b>${thaiDate(l.date)}</b><div class="small muted">${KIND_SHORT[l.kind]}${l.week ? ` · สัปดาห์ ${l.week}` : ''}${l.makeupFor ? ' · ชดเชย' : ''}${l.deload ? ' · เบา' : ''}</div></div>
      <div class="small" style="text-align:right"><b>${fmt(st.reps)}</b> ครั้ง<div class="muted">${fmt(st.volume)} กก.</div></div></button>`).join('');
  html += '</div>';
  return html;
}

export function render() {
  return `<div class="page">
    <div class="seg"><button class="${tab === 'today' ? 'on' : ''}" data-act="tab" data-t="today">วันนี้</button><button class="${tab === 'stats' ? 'on' : ''}" data-act="tab" data-t="stats">สถิติ & ประวัติ</button></div>
    ${tab === 'today' ? todayHTML() : statsHTML()}
  </div>`;
}

function ensureSession(kindHint) {
  const date = ymd();
  let log = activeSession(date);
  if (log) return log;
  const choice = todayChoice(date);
  const kind = kindHint || (kindOverride && choice.info.phase.mode === 'split' ? kindOverride : choice.kind);
  return createSession(date, kind, { extra: !!choice.rest || !!choice.practice });
}

export async function tickSet(log, exIdx, setIdx, { onAfter } = {}) {
  const p = log.plan[exIdx];
  const st = getSet(log, exIdx, setIdx);
  if (st.done) {
    const ok = await confirmDialog(`ยกเลิกการติ๊ก${log.mode === 'full' ? 'รอบ' : 'เซ็ต'}ที่ ${setIdx + 1} ของ ${EXERCISES[p.exId].nameTh}?`, { ok: 'ยกเลิกติ๊ก' });
    if (ok) { unmarkSet(log, exIdx, setIdx); onAfter && onAfter(false); }
    return;
  }
  let res;
  const last = lastReps(p.exId, setIdx, log.id);
  if (p.type === 'time') {
    res = await plankSheet({ target: p.seconds, setNo: setIdx + 1, totalSets: p.sets });
  } else {
    const prev = setIdx > 0 ? getSet(log, exIdx, setIdx - 1) : null;
    const prefill = (prev && prev.reps) || (last && last.reps) || p.target || 10;
    res = await repsSheet({ exId: p.exId, setNo: setIdx + 1, totalSets: p.sets, targetText: p.text, prefill, last });
  }
  if (!res) return;
  const { allDone } = markSet(log, exIdx, setIdx, res);
  if (allDone) {
    const { streak } = finishSession(log);
    onAfter && onAfter(true);
    celebrateSheet(log, streak);
    return;
  }
  const rest = restAfter(log, exIdx, setIdx);
  if (rest) startRest(rest.sec, { label: rest.label, next: rest.next });
  onAfter && onAfter(false);
}

export function mount(root) {
  root.addEventListener('click', async e => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'tab') { tab = a.dataset.t; refresh(); }
    else if (act === 'info') exerciseSheet(a.dataset.id);
    else if (act === 'kind') { kindOverride = a.dataset.k; refresh(true); }
    else if (act === 'set') {
      const log = ensureSession();
      await tickSet(log, +a.dataset.ex, +a.dataset.set, { onAfter: () => refresh(true) });
      refresh(true);
    } else if (act === 'play') {
      const log = ensureSession(a.dataset.kind);
      openPlayer(log.id);
    } else if (act === 'finish') {
      const log = activeSession(ymd());
      if (!log) return;
      const pr = progress(log);
      if (pr.done < pr.total && !(await confirmDialog(`ทำไป ${pr.done}/${pr.total} เซ็ต จบวันนี้เลยไหม?`, { ok: 'จบเลย' }))) return;
      const { streak } = finishSession(log);
      refresh(true);
      celebrateSheet(log, streak);
    } else if (act === 'discard') {
      if (await confirmDialog('ลบการเล่นครั้งนี้ทิ้ง? เซ็ตที่ติ๊กไว้จะหายไป', { ok: 'ลบ', danger: true })) { deleteLog(a.dataset.id); refresh(true); }
    } else if (act === 'makeup') {
      const choice = todayChoice(ymd());
      const kind = choice.info.phase.mode === 'full' ? 'F' : choice.kind;
      const log = createSession(ymd(), kind, { makeupFor: a.dataset.date });
      toast('เริ่มเล่นชดเชยแล้ว 💪');
      openPlayer(log.id);
    } else if (act === 'extra' || act === 'again') {
      const choice = todayChoice(ymd());
      const kind = choice.info.phase.mode === 'full' ? 'F' : choice.kind;
      createSession(ymd(), act === 'again' && choice.info.phase.mode === 'split' ? (choice.kind === 'A' ? 'B' : 'A') : kind, { extra: true });
      refresh(true);
    } else if (act === 'view') viewLog(a.dataset.id);
    else if (act === 'routine') {
      const kind = a.dataset.k;
      openRoutine(kind, {
        onDone: done => {
          if (!done) return;
          saveMeta({ [`${kind}Date`]: ymd() });
          const log = activeSession(ymd()) || lastCompletedOn(ymd());
          if (log) { log[kind === 'warm' ? 'warmupDone' : 'cooldownDone'] = true; saveLog(log); }
          refresh(true);
        },
      });
    }
    else if (act === 'stay') {
      if (await confirmDialog('เลื่อนแผนทั้งหมดออกไป 1 สัปดาห์? (สัปดาห์หน้าจะยังอยู่ช่วงเดิม แก้กลับได้ในตั้งค่า)', { ok: 'อยู่ช่วงเดิมต่อ' })) {
        const s = settings();
        await saveSettings({ weekOffset: (s.weekOffset || 0) + 1 });
        toast('เลื่อนแผนออกไป 1 สัปดาห์แล้ว');
        refresh(true);
      }
    }
  });
}

function viewLog(id) {
  const log = workoutLogs().find(l => l.id === id);
  if (!log) return;
  const st = sessionStats(log);
  const rows = log.plan.map((p, i) => {
    const sets = log.sets.filter(s => s.exIdx === i);
    return `<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="grow">${esc(EXERCISES[p.exId].nameTh)}</span>
      <span class="small num">${sets.map(s => (s.done ? (s.reps ?? (s.seconds != null ? s.seconds + 'วิ' : '✓')) : '–')).join(' · ')}</span></div>`;
  }).join('');
  const sh = openSheet({
    title: `${thaiDate(log.date)} · ${KIND_SHORT[log.kind]}`,
    body: `<div class="col">
      <div class="tiles"><div class="tile"><small>รวม</small><b>${fmt(st.reps)}</b><span>ครั้ง</span></div><div class="tile"><small>Volume</small><b>${fmt(st.volume)}</b><span>กก.</span></div></div>
      <div>${rows}</div>
      <div class="small muted">${log.week ? `สัปดาห์ ${log.week} · ช่วง ${log.phase}` : 'ก่อนเริ่มแผน'}${log.durationMin ? ` · ${log.durationMin} นาที · ~${log.kcalBurned} kcal` : ''}${log.makeupFor ? ` · ชดเชยวันที่ ${thaiDate(log.makeupFor, { weekday: false })}` : ''}</div>
      <button class="btn btn-danger" data-del>ลบประวัตินี้</button>
    </div>`,
    onMount: el => {
      el.querySelector('[data-del]').onclick = async () => {
        if (await confirmDialog('ลบประวัติการเล่นนี้?', { ok: 'ลบ', danger: true })) { deleteLog(id); sh.close(); refresh(true); }
      };
    },
  });
}
