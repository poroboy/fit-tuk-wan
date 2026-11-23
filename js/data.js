// App data accessors on top of the store
import { get, set } from './store.js';
import { computeTargets } from './nutrition.js';
import { DEFAULT_MY_MEALS } from './foods.js';
import { ymd, addDays, isComplete } from './plan.js';

export const DEFAULT_SETTINGS = {
  startDate: '2026-11-23',
  weekOffset: 0,
  dumbbellKg: 4.5,
  restSec: 60,
  roundRestSec: 90,
  circuitGapSec: 20,
  boardColors: { chest: 'red', shoulder: 'blue', triceps: 'yellow' },
  theme: 'auto',
  sound: true,
  vibrate: true,
  voiceCount: true,
  waterGoal: 8,
  workoutReminder: true,
  reminderTime: '19:00',
  mealReminder: true,
  mealTimes: { breakfast: '09:30', lunch: '13:30', dinner: '20:30' },
  proteinReminder: true,
  proteinTime: '20:00',
  weighReminder: true,
  measureReminder: true,
};
export const DEFAULT_PROFILE = {
  sex: 'male', age: 25, heightCm: 170, weightKg: 65,
  activity: 'ex3', goalMode: 'bulk', proteinPerKg: 1.6, setupDone: false,
};

export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function mergeSettings(raw = {}) {
  return {
    ...DEFAULT_SETTINGS, ...raw,
    mealTimes: { ...DEFAULT_SETTINGS.mealTimes, ...(raw.mealTimes || {}) },
    boardColors: { ...DEFAULT_SETTINGS.boardColors, ...(raw.boardColors || {}) },
  };
}
export const settings = () => mergeSettings(get('settings', {}));
export const saveSettings = patch => set('settings', { ...get('settings', {}), ...patch });

export const profile = () => ({ ...DEFAULT_PROFILE, ...get('profile', {}) });
export const saveProfile = patch => set('profile', { ...get('profile', {}), ...patch });

// ---------- workouts ----------
export const workoutLogs = () => get('workoutLogs', []);
export function saveLog(log) {
  const logs = workoutLogs().slice();
  const i = logs.findIndex(l => l.id === log.id);
  if (i >= 0) logs[i] = log; else logs.push(log);
  logs.sort((a, b) => a.date.localeCompare(b.date) || String(a.startedAt).localeCompare(String(b.startedAt)));
  return set('workoutLogs', logs);
}
export const deleteLog = id => set('workoutLogs', workoutLogs().filter(l => l.id !== id));
export const logsOn = date => workoutLogs().filter(l => l.date === date);
export const completedLogs = () => workoutLogs().filter(isComplete);

// ---------- food ----------
export const foodLogs = () => get('foodLogs', []);
export const foodOn = date => foodLogs().filter(l => l.date === date);
export function addFood(entry) { return set('foodLogs', [...foodLogs(), { id: uid('fl'), ...entry }]); }
export function addFoods(entries) { return set('foodLogs', [...foodLogs(), ...entries.map(e => ({ id: uid('fl'), ...e }))]); }
export function updateFood(id, patch) { return set('foodLogs', foodLogs().map(l => (l.id === id ? { ...l, ...patch } : l))); }
export function deleteFood(id) { return set('foodLogs', foodLogs().filter(l => l.id !== id)); }
export const customFoods = () => get('customFoods', []);
export const saveCustomFoods = list => set('customFoods', list);
export const myMeals = () => get('myMeals', DEFAULT_MY_MEALS);
export const saveMyMeals = list => set('myMeals', list);
export const recentFoodIds = () => get('recentFoods', []);
export function pushRecent(foodId) {
  if (!foodId) return;
  const list = [foodId, ...recentFoodIds().filter(x => x !== foodId)].slice(0, 12);
  set('recentFoods', list);
}

export const water = date => (get('water', {})[date] || 0);
export const setWater = (date, n) => set('water', { ...get('water', {}), [date]: Math.max(0, n) });

// ---------- body ----------
export const bodyLogs = () => get('bodyLogs', []);
export function saveBody(date, patch) {
  const logs = bodyLogs().slice();
  const i = logs.findIndex(l => l.date === date);
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== '' && v != null && !Number.isNaN(v)));
  if (i >= 0) logs[i] = { ...logs[i], ...clean }; else logs.push({ id: uid('bl'), date, ...clean });
  logs.sort((a, b) => a.date.localeCompare(b.date));
  return set('bodyLogs', logs);
}
export function clearBodyField(date, field) {
  const logs = bodyLogs().map(l => {
    if (l.date !== date) return l;
    const c = { ...l }; delete c[field]; return c;
  }).filter(l => ['weightKg', 'armCm', 'chestCm', 'waistCm', 'shoulderCm'].some(k => l[k] != null));
  return set('bodyLogs', logs);
}
export const weightLogs = () => bodyLogs().filter(l => l.weightKg != null);
export const measureLogs = () => bodyLogs().filter(l => ['armCm', 'chestCm', 'waistCm', 'shoulderCm'].some(k => l[k] != null));
export function latestWeight() {
  const w = weightLogs();
  return w.length ? w[w.length - 1].weightKg : profile().weightKg;
}
export const targets = () => computeTargets(profile(), latestWeight());

// ---------- misc ----------
export const meta = () => get('meta', {});
export const saveMeta = patch => set('meta', { ...meta(), ...patch });

export function proteinMet(date) {
  const t = targets();
  const p = foodOn(date).reduce((s, it) => s + it.p * (it.per === '100g' ? it.qty / 100 : it.qty), 0);
  return p >= t.protein * 0.95;
}

export const today = () => ymd();
export const yesterday = () => addDays(ymd(), -1);
