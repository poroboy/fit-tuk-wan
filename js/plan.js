// Training plan logic — pure functions (used by the page and the service worker).

export const DAY_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
export const DAY_LONG = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export const MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// ---------- dates (local, 'YYYY-MM-DD') ----------
export function ymd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
export function diffDays(a, b) {
  return Math.round((parseYmd(a) - parseYmd(b)) / 86400000);
}
export function weekday(s) { return parseYmd(s).getDay(); }
export function mondayOf(s) { return addDays(s, -((weekday(s) + 6) % 7)); }
export function thaiDate(s, { weekday: wd = true, year = false } = {}) {
  const d = parseYmd(s);
  let out = `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  if (year) out += ` ${d.getFullYear() + 543}`;
  if (wd) out = `${DAY_LONG[d.getDay()]} ${out}`;
  return out;
}
export function timeToMin(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// ---------- phases ----------
export const PHASES = [
  { n: 1, from: 1, to: 2, name: 'ปูพื้นฐาน', mode: 'full', sets: 3, reps: '10–12', repsTarget: 12, plank: 30, plankText: '30', note: 'เน้นท่าให้ถูก' },
  { n: 2, from: 3, to: 4, name: 'เพิ่มความหนัก', mode: 'full', sets: 3, reps: '12–15', repsTarget: 13, plank: 45, plankText: '45–60', note: 'ลงช้า 3 วินาที' },
  { n: 3, from: 5, to: 8, name: 'เพิ่มความยาก', mode: 'full', sets: 3, reps: '12–15', repsTarget: 13, plank: 45, plankText: '45–60', note: 'วิดพื้นยกเท้าวางบนเตียง · ลงช้า 3 วิ + ค้างบน 1 วิ ทุกท่า (หนักขึ้นโดยไม่เพิ่มเวลา)' },
  { n: 4, from: 9, to: 12, name: 'แยก 2 ชุด (Superset)', mode: 'split', sets: 3, reps: '12–15', repsTarget: 13, plank: 60, plankText: '60', note: 'จับคู่ 2 ท่าทำต่อกันไม่พัก · ค้าง 2 วิ ตอนยกถึงจุดสุด' },
  { n: 5, from: 13, to: Infinity, name: 'เพิ่มความยากด้วยเทคนิค', mode: 'split', sets: 3, reps: '12–20', repsTarget: 15, plank: 60, plankText: '60–90', note: 'ดัมเบลเดิม: ลงช้า 4 วิ ค้างบน 2 วิ หรือ 1½ reps (เบาไปให้ทำทีละข้าง) ทำจนเริ่มช้าลงชัดๆ' },
];
export function phaseForWeek(week) {
  return PHASES.find(p => week >= p.from && week <= p.to) || PHASES[0];
}
export const isDeload = week => week > 0 && week % 8 === 0;

const SCHEDULE = {
  full: { 1: 'F', 3: 'F', 5: 'F' },
  split: { 1: 'A', 2: 'B', 4: 'A', 5: 'B' },
};
export const scheduledKind = (phase, wd) => SCHEDULE[phase.mode][wd] || null;
export const sessionsPerWeek = phase => Object.keys(SCHEDULE[phase.mode]).length;

export const KIND_NAMES = {
  F: 'ชุดรวม · ทำวนเป็นรอบ',
  A: 'ชุด A · อก + หลังแขน + หลังบน',
  B: 'ชุด B · ไหล่ + หน้าแขน + หลัง',
};
export const KIND_SHORT = { F: 'ชุดรวม', A: 'ชุด A', B: 'ชุด B' };

export function weekNumber(date, s) {
  const days = diffDays(date, s.startDate);
  if (days < 0) return 0;
  return Math.max(1, Math.floor(days / 7) + 1 - (s.weekOffset || 0));
}

export function dayInfo(date, s) {
  const week = weekNumber(date, s);
  if (week < 1) {
    return { prestart: true, week: 0, phase: PHASES[0], deload: false, kind: null, daysToStart: diffDays(s.startDate, date) };
  }
  const phase = phaseForWeek(week);
  return { prestart: false, week, phase, deload: isDeload(week), kind: scheduledKind(phase, weekday(date)) };
}

// ---------- roadmap ----------
export const weekStart = (week, s) => addDays(s.startDate, (week - 1 + (s.weekOffset || 0)) * 7);
export const DAYS_TEXT = { full: 'จ · พ · ศ', split: 'จ(A) · อ(B) · พฤ(A) · ศ(B)' };

export function roadmap(s, today) {
  const info = dayInfo(today, s);
  const week = info.prestart ? 0 : info.week;
  const phases = PHASES.map(p => ({
    ...p,
    start: weekStart(p.from, s),
    end: Number.isFinite(p.to) ? addDays(weekStart(p.to + 1, s), -1) : null,
    days: sessionsPerWeek(p),
    state: week > p.to ? 'past' : week >= p.from ? 'now' : 'next',
  }));
  // next change: next phase start or next deload week, whichever is first
  const nextPhase = phases.find(p => p.from > week);
  let nextDeload = null;
  for (let w = Math.max(week + 1, 1); w < week + 9; w++) if (isDeload(w)) { nextDeload = w; break; }
  const events = [];
  if (nextPhase) events.push({ week: nextPhase.from, kind: 'phase', phase: nextPhase, date: nextPhase.start });
  if (nextDeload) events.push({ week: nextDeload, kind: 'deload', date: weekStart(nextDeload, s) });
  if (info.deload) events.push({ week: week + 1, kind: 'deloadEnd', date: weekStart(week + 1, s) });
  events.sort((a, b) => a.week - b.week);
  const next = events[0] || null;
  if (next) next.inWeeks = next.week - week;
  return { week, phases, next, info };
}

// when to end a set (no guessing how many reps are left)
export const STOP_RULE = 'หยุดเมื่อครั้งนั้นยกช้าลงชัดๆ หรือท่าเริ่มเสีย';
export const LAST_ROUND = 'รอบสุดท้าย ทำให้สุด จนยกต่อไม่ไหวโดยท่ายังถูก';

// one-side-at-a-time exercises ("ต่อข้าง" / "ทีละข้าง")
export const isPerSide = item => item && item.type !== 'time' && /ข้าง/.test(String(item.text || ''));
export const SIDE_HINT = 'ทำข้างแรกครบ → สลับข้างทันที (ไม่ต้องพัก) → ครบ 2 ข้างแล้วค่อยกด ✓ ใส่จำนวนครั้งต่อข้าง';

// ---------- prescription ----------
// F = circuit. A/B = supersets: each inner array is a pair done back-to-back with no rest.
// 'core' = crunch, swapped for superman (lower back) on Wednesdays — same length, more back work.
const LISTS = {
  F: ['pushup', 'db_row', 'shoulder_press', 'curl', 'lateral_raise', 'plank', 'core'],
  A: [['pushup_wide', 'reverse_fly'], ['bench_dip', 'floor_fly'], ['oh_triceps', 'plank']],
  B: [['pushup_pike', 'db_row'], ['shoulder_press', 'curl'], ['lateral_raise', 'leg_raise']],
};
const FIXED = {
  pushup: { text: 'จนเริ่มช้าลงชัดๆ', target: null },
  pushup_decline: { text: 'จนเริ่มช้าลงชัดๆ', target: null },
  pushup_wide: { text: 'จนเริ่มช้าลงชัดๆ', target: null },
  pushup_narrow: { text: '8–12', target: 10 },
  pushup_pike: { text: '8–12', target: 10 },
  bench_dip: { text: '10–15', target: 12 },
  crunch: { text: '15–20', target: 15 },
  leg_raise: { text: '12–15', target: 12 },
  russian_twist: { text: '20 (นับซ้าย+ขวา)', target: 20 },
  superman: { text: '10–12 (ค้างบน 2 วิ)', target: 12 },
};

export function prescription(kind, phase, deload, wd = 1) {
  const sets = deload ? 2 : phase.sets;
  const flat = [];
  LISTS[kind].forEach((g, gi) => (Array.isArray(g) ? g : [g]).forEach(id => flat.push({ id, pair: Array.isArray(g) ? gi : null })));
  return flat.map(({ id: raw, pair }) => {
    const id = raw === 'core' ? (wd === 3 ? 'superman' : 'crunch') : raw;
    const item = presc(id, phase, sets);
    if (pair != null) item.pair = pair;
    return item;
  });
}
function presc(id, phase, sets) {
  {
    const exId = id === 'pushup' && phase.n >= 3 ? 'pushup_decline' : id;
    if (exId === 'plank') {
      return { exId, sets, type: 'time', seconds: phase.plank, text: `${phase.plankText} วิ` };
    }
    const f = FIXED[exId];
    let text = f ? f.text : phase.reps;
    if (exId === 'db_row' && !/ข้าง/.test(text)) text += ' ต่อข้าง';
    return { exId, sets, type: 'reps', text, target: f ? f.target : phase.repsTarget };
  }
}

// ---------- logs & streak ----------
export const isComplete = log => !!(log && log.completedAt);

export function doneDates(logs) {
  const set = new Set();
  for (const l of logs) {
    if (!isComplete(l)) continue;
    set.add(l.makeupFor || l.date);
  }
  return set;
}

export function dateStatus(date, s, logs, today) {
  const info = dayInfo(date, s);
  const onDate = logs.filter(l => l.date === date && isComplete(l));
  const madeUp = logs.some(l => l.makeupFor === date && isComplete(l));
  if (info.kind) {
    if (onDate.length || madeUp) return { st: 'done', info };
    if (date < today) return { st: 'miss', info };
    return { st: 'plan', info };
  }
  if (onDate.length) return { st: 'extra', info };
  return { st: 'rest', info };
}

export function computeStreak(logs, s, today) {
  const done = doneDates(logs);
  const extraDates = new Set(logs.filter(l => isComplete(l) && !l.makeupFor).map(l => l.date));
  let streak = 0;
  const earliest = logs.reduce((m, l) => (l.date < m ? l.date : m), s.startDate);
  for (let i = 0, d = today; i < 800 && d >= earliest; i++, d = addDays(d, -1)) {
    const info = dayInfo(d, s);
    if (info.kind) {
      if (done.has(d)) streak++;
      else if (d === today) continue;
      else break;
    } else if (extraDates.has(d)) {
      streak++;
    }
  }
  return streak;
}

export function weekProgress(logs, s, today) {
  const mon = mondayOf(today);
  const info = dayInfo(today, s);
  const phase = info.prestart ? PHASES[0] : info.phase;
  let planned = 0, done = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    const st = dateStatus(d, s, logs, today);
    if (st.info.kind) { planned++; if (st.st === 'done') done++; }
    else if (st.st === 'extra' && logs.some(l => l.date === d && isComplete(l) && !l.makeupFor)) done++;
  }
  return { done: Math.min(done, Math.max(planned, sessionsPerWeek(phase))), planned: planned || sessionsPerWeek(phase) };
}

// Most recent missed scheduled day within the last 6 days (for make-up sessions)
export function findMissed(logs, s, today) {
  const done = doneDates(logs);
  for (let i = 1; i <= 6; i++) {
    const d = addDays(today, -i);
    if (d < s.startDate) break;
    const info = dayInfo(d, s);
    if (info.kind && !done.has(d)) return { date: d, kind: info.kind };
  }
  return null;
}

export function nextSplitKind(logs) {
  const last = [...logs].filter(l => isComplete(l) && (l.kind === 'A' || l.kind === 'B'))
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))[0];
  return last && last.kind === 'A' ? 'B' : 'A';
}
