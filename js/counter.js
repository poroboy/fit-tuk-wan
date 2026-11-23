// Rep counter: counts reps out loud following each exercise's tempo, in sync with the animation.
import { tempoOf } from './figure.js';
import { beep, buzz } from './notify.js';
import { settings } from './data.js';

const SWITCH_SEC = 5;
const READY_SEC = 4;

export function speak(text) {
  try {
    if (!settings().voiceCount || !('speechSynthesis' in window)) return false;
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'th-TH';
    u.rate = 1.1;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}

// target: number or null (count until the user stops). perSide: count side 1 then side 2.
// onUpdate({ phase, rep, side, label, big }) / onStart() (reset the animation) / onFinish(result)
export function createCounter({ exId, target = null, perSide = false, onUpdate, onStart, onFinish }) {
  const tempo = tempoOf(exId) || [[1, 1, 'ขึ้น'], [0, 2.5, 'ลง']];
  const cycle = tempo.reduce((s, x) => s + x[1], 0);
  const st = { phase: 'ready', t0: performance.now(), side: 1, rep: 0, counts: [0, 0], lastSeg: -1, lastSec: null, stopped: false };
  let iv = null;

  const emit = (label, big) => onUpdate && onUpdate({ phase: st.phase, rep: st.rep, side: st.side, label, big, target, perSide });

  function startCounting() {
    st.phase = 'count';
    st.t0 = performance.now();
    st.rep = 0; st.lastSeg = -1; st.lastSec = null;
    onStart && onStart();
    beep('go');
  }
  function finish() {
    st.phase = 'done';
    clearInterval(iv);
    beep('done'); buzz([200, 80, 200]);
    speak('ครบแล้ว เก่งมาก');
    onFinish && onFinish(result());
  }
  function result() {
    st.counts[st.side - 1] = st.rep;
    const reps = perSide && st.side === 2 ? Math.min(st.counts[0], st.counts[1]) : st.counts[0];
    return { reps, counts: [...st.counts], side: st.side };
  }

  function tick() {
    const now = performance.now();
    const t = (now - st.t0) / 1000;
    if (st.phase === 'ready' || st.phase === 'switch') {
      const total = st.phase === 'ready' ? READY_SEC : SWITCH_SEC;
      const left = Math.ceil(total - t);
      if (left !== st.lastSec) {
        st.lastSec = left;
        if (left > 0) { beep('soft'); if (left <= 3) speak(left); else if (left === total) speak(st.phase === 'ready' ? 'เตรียมตัว' : 'สลับข้าง'); }
      }
      if (t >= total) { startCounting(); return; }
      emit(st.phase === 'ready' ? 'เตรียมตัว' : `สลับข้าง! เปลี่ยนไปข้างที่ 2`, Math.max(left, 1));
      return;
    }
    if (st.phase !== 'count') return;
    const done = Math.floor(t / cycle);
    if (done > st.rep) {
      st.rep = done;
      if (!speak(st.rep)) beep('up');
      buzz([40]);
      if (target && st.rep >= target) {
        if (perSide && st.side === 1) {
          st.counts[0] = st.rep;
          st.phase = 'switch'; st.side = 2; st.t0 = now; st.lastSec = null;
          beep('done');
          return;
        }
        finish();
        return;
      }
    }
    // where are we inside this rep?
    let x = t % cycle, seg = 0;
    while (seg < tempo.length - 1 && x >= tempo[seg][1]) { x -= tempo[seg][1]; seg++; }
    const [, dur, label] = tempo[seg];
    if (seg !== st.lastSeg) {
      st.lastSeg = seg; st.lastSec = null;
      if (label && dur >= 2) beep('soft');
      else if (label && dur <= 1.3) beep('up');
    }
    let sub = '';
    if (label && dur >= 2) {
      const left = Math.ceil(dur - x);
      if (left !== st.lastSec) { st.lastSec = left; if (left < Math.ceil(dur)) beep('soft'); }
      sub = `${label} · ${left}`;
    } else sub = label || '';
    emit(sub, st.rep);
  }

  iv = setInterval(tick, 80);
  tick();
  return {
    stop() { if (st.stopped) return result(); st.stopped = true; clearInterval(iv); try { speechSynthesis.cancel(); } catch { /* ignore */ } return result(); },
    get state() { return st; },
  };
}
