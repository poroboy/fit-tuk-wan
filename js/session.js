// Workout session state (create, tick sets, finish, stats)
import { saveLog, workoutLogs, settings, latestWeight, uid, saveMeta, meta } from './data.js';
import { dayInfo, prescription, isComplete, findMissed, nextSplitKind, computeStreak, ymd, weekday } from './plan.js';
import { EXERCISES, loadPerRep, isPushup } from './exercises.js';
import { tempoLength } from './figure.js';

export function logsForDate(date) {
  return workoutLogs().filter(l => l.date === date);
}
export function activeSession(date) {
  const list = logsForDate(date);
  return list.find(l => !isComplete(l)) || null;
}
export function lastCompletedOn(date) {
  return logsForDate(date).filter(isComplete).pop() || null;
}

export function createSession(date, kind, { makeupFor = null, extra = false } = {}) {
  const s = settings();
  const info = dayInfo(date, s);
  const week = info.prestart ? 0 : info.week;
  const phase = info.phase;
  const deload = info.deload;
  const plan = prescription(kind, phase, deload, weekday(date));
  const sets = [];
  plan.forEach((p, exIdx) => {
    for (let k = 0; k < p.sets; k++) sets.push({ exIdx, exerciseId: p.exId, setIndex: k, reps: null, seconds: null, done: false });
  });
  const log = {
    id: uid('wo'), date, kind, week, phase: phase.n, deload, mode: phase.mode,
    makeupFor, extra, practice: info.prestart,
    startedAt: new Date().toISOString(), completedAt: null,
    plan, sets, dumbbellKg: s.dumbbellKg, bodyKg: latestWeight(),
  };
  saveLog(log);
  return log;
}

export function steps(log) {
  const out = [];
  const maxSets = Math.max(...log.plan.map(p => p.sets));
  if (log.mode === 'full') {
    for (let r = 0; r < maxSets; r++) log.plan.forEach((p, i) => { if (r < p.sets) out.push({ exIdx: i, setIdx: r }); });
  } else {
    // supersets: items sharing a `pair` alternate set by set (A1, A2, A1, A2…); single items go set by set
    const groups = [];
    log.plan.forEach((p, i) => {
      const g = p.pair != null ? groups.find(x => x.pair === p.pair) : null;
      if (g) g.idx.push(i); else groups.push({ pair: p.pair, idx: [i] });
    });
    for (const g of groups) {
      const n = Math.max(...g.idx.map(i => log.plan[i].sets));
      for (let r = 0; r < n; r++) g.idx.forEach(i => { if (r < log.plan[i].sets) out.push({ exIdx: i, setIdx: r }); });
    }
  }
  return out;
}
export const SUPERSET_GAP = 10; // seconds to switch to the partner exercise

// partner exercise index in the same superset pair (or -1)
export function partnerOf(plan, exIdx) {
  const p = plan[exIdx];
  if (!p || p.pair == null) return -1;
  return plan.findIndex((x, i) => i !== exIdx && x.pair === p.pair);
}
export const getSet = (log, exIdx, setIdx) => log.sets.find(s => s.exIdx === exIdx && s.setIndex === setIdx);
export function nextStep(log) {
  return steps(log).find(st => !getSet(log, st.exIdx, st.setIdx).done) || null;
}
export function progress(log) {
  const done = log.sets.filter(s => s.done).length;
  return { done, total: log.sets.length, pct: log.sets.length ? done / log.sets.length : 0 };
}

export function markSet(log, exIdx, setIdx, { reps = null, seconds = null } = {}) {
  const st = getSet(log, exIdx, setIdx);
  st.done = true;
  st.reps = reps;
  st.seconds = seconds;
  st.at = new Date().toISOString();
  saveLog(log);
  return { allDone: log.sets.every(s => s.done) };
}
export function unmarkSet(log, exIdx, setIdx) {
  const st = getSet(log, exIdx, setIdx);
  st.done = false; st.reps = null; st.seconds = null;
  saveLog(log);
}

export function finishSession(log) {
  log.completedAt = new Date().toISOString();
  const mins = Math.min(90, Math.max(10, (new Date(log.completedAt) - new Date(log.startedAt)) / 60000));
  log.durationMin = Math.round(mins);
  log.kcalBurned = Math.round(5 * (log.bodyKg || 65) * (mins / 60));
  saveLog(log);
  const s = settings();
  const streak = computeStreak(workoutLogs(), s, ymd());
  if (streak > (meta().bestStreak || 0)) saveMeta({ bestStreak: streak });
  return { streak };
}

export function sessionStats(log) {
  let reps = 0, volume = 0, pushReps = 0, maxPush = 0, plankSec = 0;
  for (const st of log.sets) {
    if (!st.done) continue;
    if (st.seconds) plankSec += st.seconds;
    if (!st.reps) continue;
    reps += st.reps;
    volume += st.reps * loadPerRep(st.exerciseId, log.bodyKg || 65, log.dumbbellKg || 4.5);
    if (isPushup(st.exerciseId)) { pushReps += st.reps; maxPush = Math.max(maxPush, st.reps); }
  }
  return { reps, volume: Math.round(volume), pushReps, maxPush, plankSec };
}

// previous reps for the same exercise & set index (for prefill / "beat last time")
export function lastReps(exId, setIdx, excludeId) {
  const logs = workoutLogs().filter(l => l.id !== excludeId && isComplete(l)).reverse();
  for (const l of logs) {
    const sets = l.sets.filter(s => s.exerciseId === exId && s.done && (s.reps || s.seconds));
    if (!sets.length) continue;
    const same = sets.find(s => s.setIndex === setIdx) || sets[sets.length - 1];
    return { reps: same.reps, seconds: same.seconds, date: l.date, best: Math.max(...sets.map(s => s.reps || s.seconds || 0)) };
  }
  return null;
}

export function restAfter(log, exIdx, setIdx) {
  const s = settings();
  const nxt = (() => {
    const all = steps(log);
    const i = all.findIndex(x => x.exIdx === exIdx && x.setIdx === setIdx);
    return all.slice(i + 1).find(x => !getSet(log, x.exIdx, x.setIdx).done) || null;
  })();
  if (!nxt) return null;
  const nextName = EXERCISES[log.plan[nxt.exIdx].exId].nameTh;
  if (log.mode === 'full') {
    const endOfRound = nxt.setIdx !== setIdx;
    return endOfRound
      ? { sec: s.roundRestSec, label: `จบรอบที่ ${setIdx + 1} · พัก 1–2 นาที`, next: nextName, step: nxt }
      : { sec: s.circuitGapSec, label: 'เปลี่ยนท่า', next: nextName, step: nxt };
  }
  const cur = log.plan[exIdx], nx = log.plan[nxt.exIdx];
  if (cur.pair != null && nx.pair === cur.pair && nxt.exIdx !== exIdx && nxt.setIdx === setIdx) {
    // second half of a superset: go straight to the partner
    return { sec: SUPERSET_GAP, label: 'Superset · ต่อท่าคู่ทันที', next: nextName, step: nxt };
  }
  const endPair = cur.pair != null;
  return { sec: s.restSec, label: endPair ? (nx.pair === cur.pair ? 'จบ 1 รอบของคู่นี้ · พัก' : 'จบคู่นี้ · พักแล้วไปคู่ถัดไป') : nxt.exIdx === exIdx ? 'พักระหว่างเซ็ต' : 'เปลี่ยนท่า', next: nextName, step: nxt };
}

// rough minutes for a session (excluding warm-up / cool-down)
export function estimateMinutes(plan, mode) {
  const s = settings();
  const fake = { mode, plan, sets: [] };
  plan.forEach((p, i) => { for (let k = 0; k < p.sets; k++) fake.sets.push({ exIdx: i, setIndex: k, done: false }); });
  const order = steps(fake);
  let sec = 0;
  order.forEach((st, n) => {
    const p = plan[st.exIdx];
    const work = p.type === 'time' ? p.seconds : (p.target || 12) * tempoLength(p.exId) * 0.8;
    sec += work * (/ข้าง/.test(String(p.text)) && p.type !== 'time' ? 2 : 1) + 8;
    const nx = order[n + 1];
    if (!nx) return;
    if (mode === 'full') sec += nx.setIdx !== st.setIdx ? s.roundRestSec : s.circuitGapSec;
    else if (p.pair != null && plan[nx.exIdx].pair === p.pair && nx.exIdx !== st.exIdx && nx.setIdx === st.setIdx) sec += SUPERSET_GAP;
    else sec += s.restSec;
  });
  return Math.round(sec / 60);
}

export function todayChoice(date) {
  const s = settings();
  const info = dayInfo(date, s);
  const logs = workoutLogs();
  if (info.prestart) return { info, kind: 'F', extra: true, practice: true };
  if (info.kind) return { info, kind: info.kind };
  const missed = findMissed(logs, s, date);
  const kind = info.phase.mode === 'full' ? 'F' : nextSplitKind(logs);
  return { info, kind, rest: true, missed };
}
