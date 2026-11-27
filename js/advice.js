// Automatic "is this exercise heavy enough?" advice, read from the reps the user recorded.
// No guessing needed from the user: we only look at what they actually did.
import { isComplete } from './plan.js';

// "10–12 ต่อข้าง" -> { low: 10, high: 12 }; "15" -> { low: 15, high: 15 }
export function repRange(text) {
  const m = String(text || '').match(/(\d+)(?:\s*–\s*(\d+))?/);
  if (!m) return null;
  return { low: +m[1], high: +(m[2] || m[1]) };
}

// recent completed sessions that include this exercise -> [{ date, reps: [..], secs: [..] }]
function history(exId, logs, excludeId, max = 3) {
  const out = [];
  for (const l of [...logs].reverse()) {
    if (!isComplete(l) || l.id === excludeId) continue;
    const sets = l.sets.filter(s => s.exerciseId === exId && s.done).sort((a, b) => a.setIndex - b.setIndex);
    if (!sets.length) continue;
    out.push({ date: l.date, reps: sets.map(s => s.reps || 0).filter(r => r > 0), secs: sets.map(s => s.seconds || 0).filter(x => x > 0) });
    if (out.length >= max) break;
  }
  return out;
}

// returns { kind: 'up' | 'ok' | 'low' | 'trend', icon, text } or null
export function exerciseAdvice(p, logs, excludeId) {
  const h = history(p.exId, logs, excludeId);
  if (!h.length) return null;
  const last = h[0];

  if (p.type === 'time') {
    if (last.secs.length && Math.min(...last.secs) >= p.seconds + 15) {
      return { kind: 'up', icon: '🔼', text: `ครั้งก่อนค้างได้ทุกเซ็ตเกิน ${p.seconds + 15} วิ ลองเพิ่มเป้าเองอีก 10 วิ` };
    }
    return null;
  }
  if (!last.reps.length) return null;
  const first = last.reps[0], end = last.reps[last.reps.length - 1];
  const r = repRange(p.text);

  // open-ended sets (push-ups "until it slows down"): show the trend instead
  if (!r || p.target == null) {
    const prev = h[1];
    if (prev && prev.reps.length) {
      const a = Math.max(...prev.reps), b = Math.max(...last.reps);
      if (b > a) return { kind: 'trend', icon: '📈', text: `ครั้งก่อนได้สูงสุด ${b} ครั้ง (ดีขึ้นจาก ${a}) ลองให้ได้ ${b + 1}` };
    }
    return { kind: 'trend', icon: '🎯', text: `ครั้งก่อนได้ ${last.reps.join(' · ')} ลองทำให้ได้มากกว่าเดิม 1 ครั้ง` };
  }

  const flatAtTop = rr => rr.length >= 2 && Math.min(...rr) >= r.high;
  // too easy: every set hit the top of the range, in the last 2 sessions (or 3+ over the top once)
  if ((flatAtTop(last.reps) && h[1] && flatAtTop(h[1].reps)) || (last.reps.length >= 2 && Math.min(...last.reps) >= r.high + 3)) {
    return { kind: 'up', icon: '🔼', text: `ท่านี้เบาไปแล้ว ทำได้เต็ม ${r.high} ทุกเซ็ต ครั้งนี้ลอง: ลงช้า 4 วิ + ค้างบน 1 วิ หรือทำ ${r.high + 3} ครั้ง` };
  }
  // too hard: well below the bottom of the range
  const avg = last.reps.reduce((a, b) => a + b, 0) / last.reps.length;
  if (avg < r.low * 0.7) {
    return { kind: 'low', icon: '💪', text: `ครั้งก่อนเฉลี่ย ${Math.round(avg)} ครั้ง ยังต่ำกว่าเป้า ไม่เป็นไร ท่าถูกสำคัญกว่า พยายามเพิ่มทีละ 1 ครั้ง` };
  }
  // reps fall across the sets = the weight is doing its job
  if (last.reps.length >= 2 && end < first) {
    return { kind: 'ok', icon: '✅', text: `หนักกำลังดี (ครั้งก่อน ${last.reps.join(' → ')}) ลองให้เซ็ตแรกได้ ${Math.min(first + 1, r.high + 3)}` };
  }
  return { kind: 'ok', icon: '🎯', text: `ครั้งก่อน ${last.reps.join(' · ')} ลองเพิ่มอีก 1 ครั้งในเซ็ตที่ทำได้น้อยสุด` };
}
