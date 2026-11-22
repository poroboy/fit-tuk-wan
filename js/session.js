// Workout session state (create, tick sets, finish, stats)
import { saveLog, workoutLogs, settings, latestWeight, uid, saveMeta, meta } from './data.js';
import { dayInfo, prescription, isComplete, findMissed, nextSplitKind, computeStreak, ymd } from './plan.js';
import { EXERCISES, loadPerRep, isPushup } from './exercises.js';

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
  const plan = prescription(kind, phase, deload);
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
    log.plan.forEach((p, i) => { for (let r = 0; r < p.sets; r++) out.push({ exIdx: i, setIdx: r }); });
  }
  return out;
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
  return { sec: s.restSec, label: nxt.exIdx === exIdx ? 'พักระหว่างเซ็ต' : 'เปลี่ยนท่า', next: nextName, step: nxt };
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
