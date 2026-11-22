// Thai food seed data (approximate values). per: 'unit' = values per 1 unit, '100g' = per 100 g (qty in grams)
const F = (id, name, unit, kcal, p, c, f, kw = '', per = 'unit') => ({ id, name, unit, kcal, p, c, f, kw, per });

export const FOODS = [
  F('egg_boiled', 'ไข่ไก่ต้ม', 'ฟอง (50 g)', 75, 6.5, 0.6, 5, 'ไข่ต้ม egg'),
  F('egg_fried', 'ไข่ดาว', 'ฟอง', 110, 6.5, 0.6, 9, 'egg'),
  F('egg_omelette', 'ไข่เจียว', 'ฟอง', 150, 7, 0.8, 13, 'egg omelette'),
  F('egg_white', 'ไข่ขาว', 'ฟอง', 17, 3.6, 0.2, 0.1, 'egg white'),
  F('egg_steamed', 'ไข่ตุ๋น', 'ถ้วย', 90, 8, 2, 5, 'egg'),
  F('rice_scoop', 'ข้าวสวย', 'ทัพพี (~60 g)', 80, 1.5, 18, 0.2, 'ข้าว rice'),
  F('rice_plate', 'ข้าวสวย', 'จาน (~180 g)', 240, 4.5, 53, 0.5, 'ข้าว rice'),
  F('rice_brown', 'ข้าวกล้อง', 'ทัพพี (~60 g)', 70, 1.6, 14.5, 0.6, 'ข้าว brown rice'),
  F('sticky_rice', 'ข้าวเหนียว', 'ห่อ (~100 g)', 200, 4, 44, 0.4, 'ข้าว sticky'),
  F('bread_ww', 'ขนมปังโฮลวีท', 'แผ่น', 70, 3, 12, 1, 'bread'),
  F('bread_white', 'ขนมปังขาว', 'แผ่น', 75, 2.5, 14, 1, 'bread'),
  F('oat', 'ข้าวโอ๊ต', '4 ช้อนโต๊ะ (~30 g)', 115, 4, 20, 2, 'oat โอ๊ต'),
  F('sweet_potato', 'มันหวานต้ม', '100 g', 86, 1.6, 20, 0.1, 'มันเทศ sweet potato', '100g'),
  F('pork_minced', 'หมูสับ (ดิบ)', '100 g', 220, 19, 0, 15, 'หมู pork', '100g'),
  F('pork_loin', 'หมูสันใน', '100 g', 143, 26, 0, 3.5, 'หมู pork', '100g'),
  F('chicken_breast', 'อกไก่ (สุก)', '100 g', 165, 31, 0, 3.6, 'ไก่ chicken', '100g'),
  F('chicken_ready', 'อกไก่พร้อมทาน', 'ซอง (~100 g)', 110, 23, 2, 1.5, 'ไก่ chicken'),
  F('shrimp', 'กุ้ง (สุก)', '100 g', 99, 24, 0.2, 0.3, 'shrimp', '100g'),
  F('tuna_can', 'ทูน่ากระป๋องในน้ำแร่', 'กระป๋อง', 110, 24, 0, 1, 'ปลา tuna'),
  F('mackerel_can', 'ปลากระป๋องซอสมะเขือเทศ', 'กระป๋องเล็ก', 160, 13, 6, 9, 'ปลา'),
  F('tofu_egg', 'เต้าหู้ไข่', 'หลอด', 100, 8, 3, 6, 'tofu'),
  F('tofu_firm', 'เต้าหู้แข็ง', '100 g', 145, 15, 3, 8, 'tofu', '100g'),
  F('veg_stirfry', 'ผักรวมผัด', 'จาน (~150 g)', 90, 3, 9, 5, 'ผัก vegetable'),
  F('veg_boiled', 'ผักลวก', 'ถ้วย', 30, 2, 6, 0.2, 'ผัก vegetable'),
  F('morning_glory', 'ผัดผักบุ้ง', 'จาน', 130, 3, 8, 10, 'ผัก'),
  F('oil', 'น้ำมันพืช', 'ช้อนโต๊ะ', 120, 0, 0, 14, 'oil'),
  F('banana', 'กล้วยหอม', 'ลูก', 105, 1.3, 27, 0.4, 'banana'),
  F('banana_nw', 'กล้วยน้ำว้า', 'ลูก', 60, 0.7, 15, 0.1, 'banana'),
  F('apple', 'แอปเปิ้ล', 'ลูก', 95, 0.5, 25, 0.3, 'apple'),
  F('papaya', 'มะละกอสุก', 'ถ้วย (~150 g)', 60, 0.7, 15, 0.4, 'ผลไม้'),
  F('milk', 'นมจืด', 'กล่อง (200 ml)', 130, 6.5, 10, 7, 'นม milk'),
  F('milk_low', 'นมจืดไขมันต่ำ', 'กล่อง (200 ml)', 95, 6.5, 10, 3, 'นม milk'),
  F('soy_milk', 'นมถั่วเหลือง', 'กล่อง (230 ml)', 120, 7, 14, 4, 'นม soy'),
  F('greek_yogurt', 'กรีกโยเกิร์ต', 'ถ้วย (~100 g)', 75, 10, 4, 2, 'yogurt'),
  F('whey', 'เวย์โปรตีน', 'สกู๊ป (30 g)', 120, 24, 3, 1.5, 'whey protein'),
  F('iced_coffee', 'กาแฟเย็น', 'แก้ว', 250, 4, 35, 10, 'coffee'),
  F('bubble_tea', 'ชานมไข่มุก', 'แก้ว', 350, 3, 60, 10, 'ชา tea'),
  F('kaprao_pork_egg', 'ข้าวกะเพราหมูสับไข่ดาว', 'จาน', 650, 28, 75, 26, 'กะเพรา'),
  F('kaprao_chicken', 'ข้าวกะเพราไก่', 'จาน', 550, 30, 70, 17, 'กะเพรา'),
  F('khao_man_gai', 'ข้าวมันไก่', 'จาน', 600, 25, 75, 22, 'ไก่'),
  F('fried_rice', 'ข้าวผัดหมู', 'จาน', 560, 18, 78, 19, 'ข้าวผัด'),
  F('khao_kai_jiao', 'ข้าวไข่เจียว', 'จาน', 480, 13, 55, 23, 'ไข่'),
  F('pad_thai', 'ผัดไทยกุ้งสด', 'จาน', 550, 20, 70, 20, 'ผัดไทย'),
  F('noodle_soup', 'ก๋วยเตี๋ยวน้ำใส (หมู)', 'ชาม', 350, 18, 45, 10, 'ก๋วยเตี๋ยว noodle'),
  F('jok', 'โจ๊กหมูใส่ไข่', 'ชาม', 300, 15, 40, 9, 'โจ๊ก'),
  F('khao_tom', 'ข้าวต้มหมู', 'ชาม', 250, 14, 35, 6, 'ข้าวต้ม'),
  F('som_tam', 'ส้มตำไทย', 'จาน', 120, 3, 22, 2, 'ส้มตำ'),
  F('moo_ping', 'หมูปิ้ง', 'ไม้', 90, 6, 4, 5.5, 'หมู'),
  F('gai_yang', 'ไก่ย่าง (สะโพก)', 'ชิ้น', 230, 22, 3, 14, 'ไก่'),
  F('fried_chicken', 'ไก่ทอด (น่อง)', 'ชิ้น', 250, 18, 8, 16, 'ไก่'),
  F('tom_yum', 'ต้มยำกุ้งน้ำใส', 'ถ้วย', 100, 12, 6, 3, 'ต้มยำ'),
  F('green_curry', 'แกงเขียวหวานไก่', 'ถ้วย', 300, 16, 10, 22, 'แกง'),
  F('peanut', 'ถั่วลิสงอบ', 'กำมือ (~30 g)', 170, 7, 5, 14, 'ถั่ว nut'),
  F('almond', 'อัลมอนด์', 'กำมือ (~28 g)', 165, 6, 6, 14, 'nut'),
];

export const MEALS = [
  { key: 'breakfast', name: 'มื้อเช้า', ico: '🍳' },
  { key: 'lunch', name: 'มื้อกลางวัน', ico: '🍛' },
  { key: 'dinner', name: 'มื้อเย็น', ico: '🍲' },
  { key: 'snack', name: 'ของว่าง', ico: '🍌' },
];

export const DEFAULT_MY_MEALS = [
  {
    id: 'mm_kaijiao_moo', name: 'ข้าวไข่เจียวหมูสับ + ผัก',
    items: [
      { ...pick('rice_plate'), qty: 1 },
      { ...pick('egg_omelette'), qty: 2 },
      { ...pick('pork_minced'), qty: 50 },
      { ...pick('veg_stirfry'), qty: 1 },
    ],
  },
  {
    id: 'mm_breakfast_egg', name: 'ไข่ต้ม 2 ฟอง + นม',
    items: [{ ...pick('egg_boiled'), qty: 2 }, { ...pick('milk'), qty: 1 }],
  },
];

function pick(id) {
  const f = FOODS.find(x => x.id === id);
  return { foodId: f.id, name: f.name, unit: f.unit, per: f.per, kcal: f.kcal, p: f.p, c: f.c, f: f.f };
}

// snapshot of a food for a log entry
export function snapshot(food) {
  return { foodId: food.id || null, name: food.name, unit: food.unit, per: food.per || 'unit', kcal: +food.kcal || 0, p: +food.p || 0, c: +food.c || 0, f: +food.f || 0 };
}
export function mult(item) { return item.per === '100g' ? (item.qty || 0) / 100 : (item.qty || 0); }
export function values(item) {
  const m = mult(item);
  return { kcal: item.kcal * m, p: item.p * m, c: (item.c || 0) * m, f: (item.f || 0) * m };
}
export function qtyLabel(item) {
  if (item.per === '100g') return `${Math.round(item.qty)} g`;
  const q = +(+item.qty).toFixed(2);
  // units that already contain an amount (e.g. AI "1 จาน (พิเศษ)")
  if (/^\d/.test(String(item.unit || ''))) return q === 1 ? item.unit : `${q} × ${item.unit}`;
  const unitName = String(item.unit || '').replace(/\s*\(.*\)/, '');
  return `${+(+item.qty).toFixed(2)} ${unitName}`;
}
export function sum(items) {
  return items.reduce((s, it) => {
    const v = values(it);
    s.kcal += v.kcal; s.p += v.p; s.c += v.c; s.f += v.f;
    return s;
  }, { kcal: 0, p: 0, c: 0, f: 0 });
}
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '');
export function search(q, list) {
  const n = norm(q);
  if (!n) return list;
  return list.filter(f => norm(f.name + f.kw + f.unit).includes(n));
}

// On-device fallback when AI is slow/unavailable: match known Thai dishes in the text.
const ALIASES = { 'ไข่ต้ม': 'egg_boiled', 'ไข่ลวก': 'egg_boiled', 'อกไก่': 'chicken_breast', 'นม': 'milk', 'กล้วย': 'banana', 'ทูน่า': 'tuna_can', 'เต้าหู้': 'tofu_egg', 'ผัก': 'veg_stirfry', 'เวย์': 'whey' };
const baseName = n => n.replace(/\s*\(.*?\)\s*/g, '').replace(/\s+/g, '');
export function localEstimate(text) {
  let rest = String(text || '').replace(/\s+/g, '');
  const byKey = new Map();
  for (const f of FOODS) {
    const k = baseName(f.name);
    if (k.length < 2) continue;
    const prev = byKey.get(k);
    if (!prev || f.kcal > prev.kcal) byKey.set(k, f); // e.g. prefer a plate of rice over one scoop
  }
  for (const [alias, id] of Object.entries(ALIASES)) if (!byKey.has(alias)) byKey.set(alias, FOODS.find(f => f.id === id));
  const keys = [...byKey.keys()].sort((a, b) => b.length - a.length);
  const items = [];
  const r1 = n => Math.round(n * 10) / 10;
  for (const k of keys) {
    let idx;
    while ((idx = rest.indexOf(k)) >= 0) {
      const f = byKey.get(k);
      // a number right after the name = how many, e.g. "ไข่ต้ม2"
      const m = rest.slice(idx + k.length).match(/^(\d+(?:\.\d+)?)(ฟอง|ลูก|จาน|ชิ้น|ไม้|แก้ว|ถ้วย|ชาม|กล่อง|ทัพพี)?/);
      const q = m ? Math.min(+m[1], 10) || 1 : 1;
      items.push({ name: f.name.replace(/\s*\(.*?\)/, ''), portion: q === 1 ? f.unit : `${q} × ${f.unit}`, kcal: Math.round(f.kcal * q), p: r1(f.p * q), c: r1(f.c * q), f: r1(f.f * q) });
      rest = rest.slice(0, idx) + '|' + rest.slice(idx + k.length + (m ? m[0].length : 0));
    }
  }
  if (/ข้าว/.test(rest) && !items.some(i => /ข้าว/.test(i.name))) {
    const r = FOODS.find(f => f.id === 'rice_plate');
    items.unshift({ name: r.name, portion: r.unit, kcal: r.kcal, p: r.p, c: r.c, f: r.f });
  }
  return {
    items,
    note: 'ค่าประมาณจากฐานข้อมูลในเครื่อง (ไม่ได้ใช้ AI) ตรวจตัวเลขก่อนบันทึก',
    confidence: 'low',
    model: 'local',
  };
}
