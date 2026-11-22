// Calorie & protein targets (pure)
export const ACTIVITY = {
  sedentary: { name: 'นั่งทำงาน ไม่ค่อยขยับ', f: 1.2 },
  ex3: { name: 'ออกกำลังกาย 3 วัน/สัปดาห์', f: 1.375 },
  ex45: { name: 'ออกกำลังกาย 4–5 วัน/สัปดาห์', f: 1.55 },
};
export const GOALS = {
  bulk: { name: 'เพิ่มกล้าม', sub: 'Lean bulk · TDEE + 250', delta: 250 },
  recomp: { name: 'เพิ่มกล้าม + ลดไขมัน', sub: 'Recomp · เท่ากับ TDEE', delta: 0 },
  cut: { name: 'ลดไขมัน', sub: 'TDEE − 400', delta: -400 },
};

export function computeTargets(profile, weightKg) {
  const kg = weightKg || profile.weightKg || 65;
  const cm = profile.heightCm || 170;
  const age = profile.age || 25;
  const bmr = 10 * kg + 6.25 * cm - 5 * age + (profile.sex === 'female' ? -161 : 5);
  const tdee = bmr * (ACTIVITY[profile.activity] || ACTIVITY.ex3).f;
  const kcal = Math.round((tdee + (GOALS[profile.goalMode] || GOALS.bulk).delta) / 10) * 10;
  const protein = Math.round(kg * (profile.proteinPerKg || 1.6));
  const fat = Math.round((kcal * 0.25) / 9);
  const carb = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, fat, carb, kg };
}
