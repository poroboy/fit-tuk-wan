import { settings, workoutLogs, targets, foodOn, weightLogs, measureLogs, profile, proteinMet, saveBody, latestWeight } from '../data.js';
import { ymd, thaiDate, KIND_NAMES, KIND_SHORT, computeStreak, dayInfo, diffDays, weekday } from '../plan.js';
import { sum } from '../foods.js';
import { esc, fmt, ringSVG, animateRings, flameSVG, openSheet, stepperHTML, bindStepper, toast } from '../ui.js';
import { figHTML } from '../figure.js';
import { activeSession, lastCompletedOn, todayChoice, progress, createSession } from '../session.js';
import { weekStripHTML } from './workout.js';
import { bodyInsights, weightTrend } from '../insights.js';
import { sparkline } from '../charts.js';
import { openPlayer } from '../player.js';
import { refresh } from '../app.js';

export const title = 'วันนี้';
export const kicker = () => thaiDate(ymd());

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'อรุณสวัสดิ์ ☀️' : h < 17 ? 'สวัสดีตอนบ่าย 👋' : 'สวัสดีตอนเย็น 🌙';
}

function workoutCard() {
  const date = ymd();
  const choice = todayChoice(date);
  const info = choice.info;
  const log = activeSession(date);
  const done = lastCompletedOn(date);
  const streak = computeStreak(workoutLogs(), settings(), date);
  if (done && !log) {
    return `<div class="card" style="background:var(--ok-soft)"><div class="row">
      <div style="width:64px">${flameSVG(streak)}</div>
      <div class="grow"><div class="small muted">วันนี้</div><h2 style="font-size:20px">เล่นเสร็จแล้ว! 🏆</h2><p class="small muted">${KIND_SHORT[done.kind]} · ไฟติด ${streak} ครั้งติด</p></div></div></div>`;
  }
  if (choice.rest && !log) {
    return `<div class="card"><div class="row"><div style="font-size:40px">😴</div>
      <div class="grow"><div class="small muted">วันนี้</div><h2 style="font-size:20px">วันพัก</h2><p class="small muted">ให้กล้ามได้ฟื้นตัว กินโปรตีนให้ถึงเป้า</p></div></div>
      ${choice.missed ? `<a class="btn btn-soft btn-block" style="margin-top:12px" href="#/workout">ขาดวันก่อน? เล่นวันนี้แทน →</a>` : ''}</div>`;
  }
  const kind = log ? log.kind : choice.kind;
  const pr = log ? progress(log) : null;
  const firstEx = { F: info.phase.n >= 3 ? 'pushup_decline' : 'pushup', A: 'pushup_wide', B: 'pushup_pike' }[kind];
  return `<div class="card hero">
    <div class="row between"><span class="chip">${info.prestart ? 'ซ้อมก่อนเริ่มแผน' : `สัปดาห์ ${info.week} · ช่วง ${info.phase.n}`}</span>${info.deload ? '<span class="chip">🌙 สัปดาห์เบา</span>' : ''}</div>
    <div class="row" style="margin-top:10px;align-items:flex-start">
      <div class="grow">
        <div class="card-sub">วันนี้เล่น</div>
        <h2 style="font-size:21px;margin:2px 0 4px">${esc(KIND_NAMES[kind])}</h2>
        <p class="card-sub">${info.prestart ? `แผนเริ่ม ${thaiDate(settings().startDate)}` : esc(info.phase.note)}</p>
      </div>
      <div style="width:110px;flex:none">${figHTML(firstEx, { small: true })}</div>
    </div>
    ${pr ? `<div class="progress" style="margin-top:12px;background:rgba(255,255,255,.25)"><i style="width:${pr.pct * 100}%;background:#fff"></i></div>` : ''}
    <button class="btn btn-white btn-lg btn-block" style="margin-top:12px" data-act="start" data-kind="${kind}">${pr && pr.done ? `▶ เล่นต่อ (${pr.done}/${pr.total})` : '▶ เริ่มเล่น'}</button>
  </div>`;
}

function ringsCard() {
  const t = targets();
  const tot = sum(foodOn(ymd()));
  const left = Math.max(0, t.protein - tot.p);
  return `<a class="card" href="#/food" style="text-decoration:none;display:block">
    <div class="card-h"><h3>อาหารวันนี้</h3><span class="card-sub">แตะเพื่อบันทึก →</span></div>
    <div class="rings">
      <div class="ring-wrap"><div class="ring">${ringSVG(tot.kcal, t.kcal, 'var(--brand)')}<div class="lbl"><b>${fmt(tot.kcal)}</b><small>/ ${fmt(t.kcal)} kcal</small></div></div>
        <div class="ring-cap ${tot.kcal > t.kcal * 1.05 ? 'warn' : ''}">${tot.kcal > t.kcal ? `เกิน ${fmt(tot.kcal - t.kcal)} kcal` : `เหลือ ${fmt(t.kcal - tot.kcal)} kcal`}</div></div>
      <div class="ring-wrap"><div class="ring">${ringSVG(tot.p, t.protein, 'var(--protein)')}<div class="lbl"><b>${fmt(tot.p)}</b><small>/ ${t.protein} g โปรตีน</small></div></div>
        <div class="ring-cap">${left > 0 ? `ขาดอีก ${fmt(left)} g` : 'ถึงเป้าแล้ว ✅'}</div></div>
    </div></a>`;
}

function weightCard() {
  const w = weightLogs();
  if (!w.length) {
    return `<div class="card"><div class="row"><div style="font-size:30px">⚖️</div><div class="grow"><h3>น้ำหนักล่าสุด</h3><p class="small muted">ยังไม่มีข้อมูล ชั่งสัปดาห์ละ 1–2 ครั้งตอนเช้า</p></div>
      <button class="btn btn-soft btn-sm" data-act="weigh">บันทึก</button></div></div>`;
  }
  const last = w[w.length - 1];
  const tr = weightTrend(w);
  const arrow = tr ? (tr.perWeek > 0.05 ? '↗' : tr.perWeek < -0.05 ? '↘' : '→') : '';
  return `<div class="card"><div class="row">
    <div class="grow"><div class="small muted">น้ำหนักล่าสุด · ${thaiDate(last.date, { weekday: false })}</div>
      <div class="big-num">${fmt(last.weightKg, 1)} <span style="font-size:15px;font-weight:600" class="muted">กก.</span></div>
      <div class="small ${tr && tr.perWeek > 0 ? '' : 'muted'}">${tr ? `${arrow} ${tr.perWeek > 0 ? '+' : ''}${tr.perWeek.toFixed(2)} กก./สัปดาห์` : 'ชั่งเพิ่มอีกครั้งเพื่อดูเทรนด์'}</div></div>
    <div class="col" style="align-items:flex-end">${sparkline(w.slice(-12).map(x => x.weightKg))}<button class="btn btn-soft btn-sm" data-act="weigh">+ ชั่ง</button></div>
  </div></div>`;
}

function remindersCard() {
  const s = settings(), date = ymd();
  const items = [];
  const now = new Date();
  if (weekday(date) === 1 && !weightLogs().some(l => l.date === date)) items.push({ k: 'info', i: '⚖️', t: '<b>วันจันทร์ ชั่งน้ำหนัก</b> ตอนเช้าหลังตื่นนอน', act: 'weigh' });
  const month = date.slice(0, 7);
  if (now.getDate() <= 3 && !measureLogs().some(l => l.date.startsWith(month))) items.push({ k: 'info', i: '📏', t: '<b>ต้นเดือนแล้ว</b> วัดรอบตัว + ถ่ายรูปท่าเดิม', href: '#/body' });
  for (const ins of bodyInsights(weightLogs(), measureLogs(), profile().goalMode)) items.push({ k: ins.kind, i: ins.icon, t: esc(ins.text) });
  const t = targets(), tot = sum(foodOn(date));
  if (now.getHours() >= 18 && tot.p > 0 && tot.p < t.protein * 0.8) items.push({ k: 'warn', i: '🥚', t: `โปรตีนยังขาด <b>${fmt(t.protein - tot.p)} g</b> ลองไข่ต้ม 2 ฟอง หรือนม 1 กล่อง`, href: '#/food' });
  items.push({ k: '', i: '😴', t: '<b>อย่าลืมนอน 7–8 ชม.</b> กล้ามซ่อมแซมตัวเองตอนนอน' });
  return `<div class="card"><div class="card-h"><h3>เตือนความจำ</h3></div><div class="col">
    ${items.map(x => `<${x.href ? `a href="${x.href}" style="text-decoration:none"` : 'div'} class="alert ${x.k}" ${x.act ? `data-act="${x.act}" role="button"` : ''}><span class="ai">${x.i}</span><div>${x.t}</div></${x.href ? 'a' : 'div'}>`).join('')}
  </div></div>`;
}

export function render() {
  const streak = computeStreak(workoutLogs(), settings(), ymd());
  return `<div class="page">
    <div class="row between" style="margin-top:-2px"><div><div class="small muted">${greeting()}</div></div></div>
    ${workoutCard()}
    ${ringsCard()}
    <div class="card"><div class="card-h"><h3>สัปดาห์นี้</h3><span class="card-sub">🔥 ${streak} · <span style="color:var(--protein)">●</span> โปรตีนถึงเป้า</span></div>${weekStripHTML(true, proteinMet)}</div>
    ${weightCard()}
    ${remindersCard()}
  </div>`;
}

export function weighSheet(onSaved) {
  const sh = openSheet({
    title: 'บันทึกน้ำหนักวันนี้',
    body: `<div class="col">${stepperHTML(latestWeight(), { step: 0.1, min: 20, unit: 'กิโลกรัม' })}
      <p class="small muted center">ชั่งตอนเช้าหลังเข้าห้องน้ำ ก่อนกินอาหาร</p>
      <button class="btn btn-primary btn-lg btn-block" data-save>บันทึก</button></div>`,
    onMount: el => {
      const read = bindStepper(el);
      el.querySelector('[data-save]').onclick = async () => {
        const v = Math.round(read() * 10) / 10;
        if (!(v > 20 && v < 300)) return toast('น้ำหนักไม่ถูกต้อง');
        await saveBody(ymd(), { weightKg: v });
        toast('บันทึกน้ำหนักแล้ว · คำนวณเป้าแคลใหม่ให้แล้ว');
        sh.close();
        onSaved && onSaved();
      };
    },
  });
}

export function mount(root) {
  animateRings(root);
  root.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'start') {
      const log = activeSession(ymd()) || (() => {
        const ch = todayChoice(ymd());
        return createSession(ymd(), a.dataset.kind, { extra: !!ch.practice });
      })();
      openPlayer(log.id);
    } else if (a.dataset.act === 'weigh') weighSheet(() => refresh(true));
  });
}
