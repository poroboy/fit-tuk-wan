// Which reminders are due right now (pure; used by the page and the service worker)
import { ymd, dayInfo, timeToMin, isComplete, KIND_SHORT } from './plan.js';
import { computeTargets } from './nutrition.js';

const MEAL_NAMES = { breakfast: 'มื้อเช้า', lunch: 'มื้อกลางวัน', dinner: 'มื้อเย็น' };

export function dueReminders(ctx, now = new Date()) {
  const { settings: s, profile, workoutLogs = [], foodLogs = [], bodyLogs = [] } = ctx;
  const date = ymd(now);
  const mins = now.getHours() * 60 + now.getMinutes();
  const out = [];
  const within = (t, span) => mins >= timeToMin(t) && mins < timeToMin(t) + span;

  if (s.workoutReminder) {
    const info = dayInfo(date, s);
    const done = workoutLogs.some(l => (l.date === date || l.makeupFor === date) && isComplete(l));
    if (info.kind && !done && mins >= timeToMin(s.reminderTime) && mins < 23 * 60 + 30) {
      out.push({ key: `w-${date}`, title: 'ได้เวลาออกกำลังกาย 💪', body: `วันนี้${KIND_SHORT[info.kind]} · สัปดาห์ ${info.week} ไฟกำลังรออยู่ 🔥`, url: '#/workout' });
    }
  }
  if (s.mealReminder) {
    for (const [meal, t] of Object.entries(s.mealTimes || {})) {
      if (!within(t, 180)) continue;
      const logged = foodLogs.some(l => l.date === date && l.meal === meal);
      if (!logged) out.push({ key: `m-${meal}-${date}`, title: `บันทึก${MEAL_NAMES[meal]}หรือยัง? 🍽️`, body: 'แตะเพื่อบันทึกแคลและโปรตีน', url: '#/food' });
    }
  }
  if (s.proteinReminder && within(s.proteinTime || '20:00', 150)) {
    const weights = bodyLogs.filter(l => l.weightKg != null);
    const kg = weights.length ? weights[weights.length - 1].weightKg : profile.weightKg;
    const t = computeTargets(profile, kg);
    const p = foodLogs.filter(l => l.date === date).reduce((sum, it) => sum + it.p * (it.per === '100g' ? it.qty / 100 : it.qty), 0);
    if (p > 0 && p < t.protein * 0.8) {
      out.push({ key: `p-${date}`, title: `โปรตีนยังขาดอีก ${Math.round(t.protein - p)} g`, body: 'ลองไข่ต้ม นม หรืออกไก่ก่อนนอน', url: '#/food' });
    }
  }
  if (s.weighReminder && now.getDay() === 1 && mins >= 7 * 60 && mins < 12 * 60) {
    if (!bodyLogs.some(l => l.date === date && l.weightKg != null)) {
      out.push({ key: `wt-${date}`, title: 'ชั่งน้ำหนักเช้าวันจันทร์ ⚖️', body: 'ชั่งหลังตื่นนอน ก่อนกินข้าว', url: '#/body' });
    }
  }
  if (s.measureReminder && now.getDate() === 1 && mins >= 9 * 60) {
    const month = date.slice(0, 7);
    if (!bodyLogs.some(l => l.date.startsWith(month) && (l.armCm || l.waistCm || l.chestCm))) {
      out.push({ key: `ms-${month}`, title: 'วันวัดตัวประจำเดือน 📏', body: 'วัดรอบแขน อก เอว ไหล่ แล้วถ่ายรูปท่าเดิม', url: '#/body' });
    }
  }
  return out;
}
