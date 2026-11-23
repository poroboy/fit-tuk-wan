// Suggest easy add-ons when today's calories / protein are below target (pure)
import { FOODS } from './foods.js';

const PROTEIN_FIRST = ['whey', 'milk', 'egg_boiled', 'chicken_ready', 'soy_milk', 'greek_yogurt', 'tuna_can'];
const ENERGY = ['peanut', 'banana', 'rice_scoop', 'milk', 'bread_ww', 'oat', 'almond', 'egg_omelette', 'sticky_rice'];

const food = id => FOODS.find(f => f.id === id);

const BIG = ['khao_kai_jiao', 'kaprao_chicken', 'noodle_soup', 'jok', 'fried_rice', 'khao_tom'];
const rotate = (arr, n) => { const r = arr.length ? n % arr.length : 0; return [...arr.slice(r), ...arr.slice(0, r)]; };

// gapKcal / gapP = how much is still missing. shift rotates the picks ("show me other ideas")
export function suggestAddOns(gapKcal, gapP, { shift = 0, usesWhey = false } = {}) {
  const out = [];
  let k = gapKcal, p = gapP;
  const has = id => out.some(f => f.id === id);
  const add = (f, qty = 1) => { out.push({ ...f, qty }); k -= f.kcal * qty; p -= f.p * qty; };
  // 1) a lot missing -> suggest one more real meal first
  if (k > 650) {
    const f = rotate(BIG, shift).map(food).find(x => x && x.kcal <= k);
    if (f) add(f);
  }
  // 2) still short on protein -> up to 2 protein foods
  const proteinPool = rotate(PROTEIN_FIRST.filter(id => usesWhey || id !== 'whey'), shift);
  let pCount = 0;
  for (const id of proteinPool) {
    if (p <= 5 || pCount >= 2 || out.length >= 5) break;
    const f = food(id);
    if (!f || has(id) || (f.kcal > k + 120 && out.length)) continue;
    add(f, id === 'egg_boiled' && k > 250 ? 2 : 1);
    pCount++;
  }
  // 3) fill the remaining calories with easy energy foods
  for (const id of rotate(ENERGY, shift)) {
    if (k < 80 || out.length >= 5) break;
    const f = food(id);
    if (!f || has(id) || f.kcal > k + 80) continue;
    add(f);
  }
  return out;
}

// which meal to put suggestions into, by time of day
export function mealForNow(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < 10.5) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 19.5) return 'dinner';
  return 'snack';
}
