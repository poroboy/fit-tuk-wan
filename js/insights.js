// Data-driven suggestions from body logs
import { diffDays } from './plan.js';

export function weightTrend(weights) {
  // weights: [{date, weightKg}] sorted
  if (weights.length < 2) return null;
  const last = weights[weights.length - 1];
  let ref = null;
  for (let i = weights.length - 2; i >= 0; i--) {
    const d = diffDays(last.date, weights[i].date);
    if (d >= 5) { ref = weights[i]; break; }
  }
  if (!ref) return null;
  const days = diffDays(last.date, ref.date);
  return { perWeek: ((last.weightKg - ref.weightKg) / days) * 7, days, from: ref, to: last };
}

export function movingAvg(weights, window = 7) {
  return weights.map(w => {
    const inWin = weights.filter(x => diffDays(w.date, x.date) >= 0 && diffDays(w.date, x.date) < window);
    return { date: w.date, v: inWin.reduce((s, x) => s + x.weightKg, 0) / inWin.length };
  });
}

export function bodyInsights(weights, measures, goalMode) {
  const out = [];
  const trend = weightTrend(weights);
  if (trend && goalMode === 'bulk' && trend.days <= 21 && trend.perWeek > 0.5) {
    out.push({ kind: 'warn', icon: '📈', text: `น้ำหนักขึ้น ${trend.perWeek.toFixed(2)} กก./สัปดาห์ เร็วเกินไปสำหรับ lean bulk แนะนำลดแคลลง 100–200 kcal/วัน` });
  }
  if (weights.length >= 2 && (goalMode === 'bulk' || goalMode === 'recomp')) {
    const last = weights[weights.length - 1];
    const old = [...weights].reverse().find(w => diffDays(last.date, w.date) >= 21);
    if (old && goalMode === 'bulk' && last.weightKg - old.weightKg <= 0.1) {
      out.push({ kind: 'info', icon: '🍚', text: 'น้ำหนักไม่ขึ้นเลย 3 สัปดาห์ แนะนำเพิ่มแคลอีก 100–200 kcal/วัน (เช่น ข้าวเพิ่ม 1 ทัพพี + ไข่ 1 ฟอง)' });
    }
  }
  const withWaist = measures.filter(m => m.waistCm != null);
  if (withWaist.length >= 2) {
    const b = withWaist[withWaist.length - 1];
    const a = [...withWaist].reverse().find(m => diffDays(b.date, m.date) >= 21) || withWaist[withWaist.length - 2];
    const dW = b.waistCm - a.waistCm;
    const dArm = a.armCm != null && b.armCm != null ? b.armCm - a.armCm : null;
    const dChest = a.chestCm != null && b.chestCm != null ? b.chestCm - a.chestCm : null;
    const best = Math.max(dArm ?? -Infinity, dChest ?? -Infinity);
    if (dW > 0.5 && best !== -Infinity && dW > best) {
      out.push({ kind: 'warn', icon: '⚠️', text: `รอบเอวเพิ่ม ${dW.toFixed(1)} ซม. เร็วกว่ารอบแขน/อก อาจได้ไขมันมากกว่ากล้าม ลองลดแคลลงเล็กน้อย` });
    }
  }
  if (trend && Math.abs(trend.perWeek) <= 0.5 && trend.perWeek > 0.1 && goalMode === 'bulk') {
    out.push({ kind: 'ok', icon: '✅', text: `น้ำหนักขึ้น ${trend.perWeek.toFixed(2)} กก./สัปดาห์ กำลังดีสำหรับเพิ่มกล้าม` });
  }
  return out;
}
