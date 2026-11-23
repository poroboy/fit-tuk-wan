import { targets, foodOn, foodLogs, addFood, addFoods, updateFood, deleteFood, myMeals, saveMyMeals, uid } from '../data.js';
import { ymd, addDays, thaiDate } from '../plan.js';
import { MEALS, values, qtyLabel, sum, localEstimate, snapshot } from '../foods.js';
import { suggestAddOns, mealForNow } from '../suggest.js';

const image0 = a => !!a.image && !a.text.trim();
import { esc, fmt, ringSVG, animateRings, openSheet, stepperHTML, bindStepper, toast, confirmDialog } from '../ui.js';
import { refresh } from '../app.js';
import { aiKey, saveAiKey, clearAiKey, estimateFood, testKey, imageToBase64 } from '../ai.js';

export const title = 'อาหาร';
let date = null;
export const kicker = () => (date && date !== ymd() ? thaiDate(date) : 'นับแคล + โปรตีน');

function macroBar(label, v, t, color) {
  const pct = t ? Math.min(100, (v / t) * 100) : 0;
  return `<div class="m"><b>${label}</b><span class="small muted">${fmt(v)}/${fmt(t)} g</span><div class="bar-mini"><i style="width:0;background:${color}" data-w="${pct}%"></i></div></div>`;
}

export function render() {
  if (!date) date = ymd();
  const t = targets();
  const logs = foodOn(date);
  const tot = sum(logs);
  const left = t.protein - tot.p;
  return `<div class="page">
    <div class="date-nav"><button class="icon-btn" data-act="prev" aria-label="วันก่อน">‹</button><div class="grow">${date === ymd() ? 'วันนี้' : thaiDate(date)}</div><button class="icon-btn" data-act="next" ${date >= ymd() ? 'disabled style="opacity:.35"' : ''} aria-label="วันถัดไป">›</button></div>
    <div class="card">
      <div class="rings">
        <div class="ring-wrap"><div class="ring">${ringSVG(tot.kcal, t.kcal, 'var(--brand)')}<div class="lbl"><b>${fmt(tot.kcal)}</b><small>/ ${fmt(t.kcal)} kcal</small></div></div>
          <div class="ring-cap ${tot.kcal > t.kcal * 1.05 ? 'warn' : ''}">${tot.kcal > t.kcal ? `เกิน ${fmt(tot.kcal - t.kcal)}` : `เหลือ ${fmt(t.kcal - tot.kcal)}`} kcal</div></div>
        <div class="ring-wrap"><div class="ring">${ringSVG(tot.p, t.protein, 'var(--protein)')}<div class="lbl"><b>${fmt(tot.p)}</b><small>/ ${t.protein} g โปรตีน</small></div></div>
          <div class="ring-cap" style="color:${left > 0 ? 'var(--protein)' : 'var(--ok)'}">${left > 0 ? `ยังขาดอีก ${fmt(left)} g` : 'ถึงเป้าแล้ว ✅'}</div></div>
      </div>
      <div class="macro">${macroBar('คาร์บ', tot.c, t.carb, 'var(--carb)')}${macroBar('ไขมัน', tot.f, t.fat, 'var(--fat)')}${macroBar('โปรตีน', tot.p, t.protein, 'var(--protein)')}</div>
    </div>
    ${suggestHTML(t, tot, logs)}
    ${MEALS.map(m => {
      const items = logs.filter(l => l.meal === m.key);
      const ms = sum(items);
      return `<div class="card meal">
        <div class="meal-h"><span class="ico">${m.ico}</span><div class="grow"><h3>${m.name}</h3><div class="small muted">${items.length ? `${fmt(ms.kcal)} kcal · โปรตีน ${fmt(ms.p)} g` : 'ยังไม่ได้บันทึก'}</div></div>
          <button class="btn btn-soft btn-sm" data-act="add" data-meal="${m.key}">+ เพิ่ม</button></div>
        ${items.length ? `<div class="meal-items">${items.map(it => { const v = values(it); return `<button class="food-row" data-act="edit" data-id="${it.id}"><div class="grow"><b>${esc(it.name)}</b><small>${esc(qtyLabel(it))}</small></div><div class="kc">${fmt(v.kcal)}<small>P ${fmt(v.p, 1)} g</small></div></button>`; }).join('')}</div>` : ''}
      </div>`;
    }).join('')}
    <div class="card"><div class="small muted">เป้าวันละ ${fmt(t.kcal)} kcal (TDEE ${fmt(t.tdee)}) · โปรตีน ${t.protein} g · ไขมัน ${t.fat} g · คาร์บ ${t.carb} g<br>คำนวณจากโปรไฟล์และน้ำหนักล่าสุด ${fmt(t.kg, 1)} กก. แก้ได้ในตั้งค่า</div></div>
    <div class="small muted center">ตัวเลขแคลอรี่เป็นค่าประมาณ ให้ดูแนวโน้มน้ำหนักตัวประกอบด้วย</div>
  </div>`;
}

export function mount(root) {
  animateRings(root);
  root.addEventListener('click', async e => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'prev') { date = addDays(date, -1); refresh(); }
    else if (act === 'next') { if (date < ymd()) { date = addDays(date, 1); refresh(); } }
    else if (act === 'add') addSheet(a.dataset.meal);
    else if (act === 'edit') editSheet(a.dataset.id);
    else if (act === 'sugmore') { sugShift += 3; refresh(true); }
    else if (act === 'sugadd' || act === 'sugall') {
      const picks = sugPicks();
      const chosen = act === 'sugall' ? picks : [picks[+a.dataset.i]].filter(Boolean);
      const meal = mealForNow();
      addFoods(chosen.map(f => ({ ...snapshot(f), qty: f.qty, date, meal })));
      toast(`เพิ่ม ${chosen.map(f => f.name).join(', ')} แล้ว`);
      refresh(true);
    }
  });
}

// ---------- "still short" suggestions ----------
let sugShift = 0;
function suggestHTML(t, tot, logs) {
  if (date !== ymd()) return '';
  const gapK = Math.round(t.kcal - tot.kcal), gapP = Math.round(t.protein - tot.p);
  if (gapK < 150 && gapP < 10) return '';
  const hour = new Date().getHours();
  if (!logs.length && hour < 11) return ''; // nothing logged yet this morning — no need to nag
  const usesWhey = logs.some(l => /เวย์|whey/i.test(l.name)) || foodLogs().some(l => /เวย์|whey/i.test(l.name));
  const picks = suggestAddOns(gapK, gapP, { shift: sugShift, usesWhey });
  if (!picks.length) return '';
  const meal = mealForNow();
  const mealName = MEALS.find(m => m.key === meal).name;
  const pk = picks.reduce((a, f) => a + f.kcal * f.qty, 0), pp = picks.reduce((a, f) => a + f.p * f.qty, 0);
  const headline = gapK >= 150 && gapP >= 10 ? `ยังขาด <b>${fmt(gapK)} kcal</b> และโปรตีน <b>${fmt(gapP)} g</b>`
    : gapK >= 150 ? `แคลยังขาดอีก <b>${fmt(gapK)} kcal</b> (โปรตีนครบแล้ว ✅)` : `โปรตีนยังขาดอีก <b>${fmt(gapP)} g</b>`;
  const tip = hour < 18 ? 'ยังมีมื้อเหลือ เติมในมื้อถัดไปหรือเป็นของว่างได้' : 'เติมเป็นของว่างก่อนนอนได้ เช่น นม กล้วย ถั่ว';
  return `<div class="card sug">
    <div class="card-h"><h3>💡 เติมให้ถึงเป้า</h3><button class="btn btn-ghost btn-sm" data-act="sugmore">แนะนำอย่างอื่น ↻</button></div>
    <p class="small">${headline}<br><span class="muted">${tip}</span></p>
    <div class="col" style="gap:0;margin-top:6px">${picks.map((f, i) => `<div class="food-row"><div class="grow"><b>${esc(f.name)}</b><small>${f.qty > 1 ? f.qty + ' × ' : ''}${esc(f.unit)} · ${fmt(f.kcal * f.qty)} kcal · P ${fmt(f.p * f.qty, 1)} g</small></div>
      <button class="btn btn-soft btn-sm" data-act="sugadd" data-i="${i}">+ เพิ่ม</button></div>`).join('')}</div>
    <button class="btn btn-primary btn-block" style="margin-top:10px" data-act="sugall">เพิ่มทั้งหมดลง${mealName} (+${fmt(pk)} kcal · P ${fmt(pp, 1)} g)</button>
  </div>`;
}
function sugPicks() {
  const t = targets(), tot = sum(foodOn(date));
  const usesWhey = foodLogs().some(l => /เวย์|whey/i.test(l.name));
  return suggestAddOns(Math.round(t.kcal - tot.kcal), Math.round(t.protein - tot.p), { shift: sugShift, usesWhey });
}

// ---------- AI estimate pane ----------
let ai = null;
function aiPane(pane, meal, closeSheet) {
  const draw = () => {
    if (!aiKey()) {
      pane.innerHTML = `<div class="col">
        <div class="alert info"><span class="ai">🤖</span><div>ใช้ Google Gemini ประเมินแคล/โปรตีนจากชื่อเมนูหรือรูป <b>ฟรี</b> (มีโควตาต่อวัน) ต้องมี API key ของคุณเองก่อน</div></div>
        <ol class="small" style="margin:0;padding-left:20px">
          <li>เปิด <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color:var(--brand-ink);font-weight:700">aistudio.google.com/apikey</a> แล้วล็อกอินด้วยบัญชี Google</li>
          <li>กด <b>Create API key</b> แล้วคัดลอก</li>
          <li>วางในช่องด้านล่าง</li></ol>
        <input class="input" type="password" autocomplete="off" placeholder="วาง API key ที่นี่" data-ai="keyin">
        <button class="btn btn-primary btn-block" data-ai="savekey">บันทึก key</button>
        <p class="tiny muted">🔒 key เก็บในเครื่องนี้เท่านั้น ไม่อยู่ในไฟล์ Export · ข้อความ/รูปที่ส่งไปจะถูกประมวลผลโดย Google (แบบฟรีอาจถูกนำไปปรับปรุงบริการ)</p></div>`;
      return;
    }
    const r = ai.result;
    pane.innerHTML = `<div class="col">
      <textarea class="input" rows="2" placeholder="พิมพ์สิ่งที่กิน เช่น ข้าวกะเพราหมูสับไข่ดาว พิเศษ + ชาเย็นหวานน้อย" data-ai="text">${esc(ai.text)}</textarea>
      <div class="row">
        <label class="btn btn-soft btn-sm" style="cursor:pointer">📷 ถ่าย/เลือกรูป<input type="file" accept="image/*" capture="environment" data-ai="photo" hidden></label>
        ${ai.image ? `<img src="${ai.image.dataUrl}" alt="รูปอาหาร" style="width:52px;height:52px;object-fit:cover;border-radius:10px"><button class="btn btn-ghost btn-sm" data-ai="rmphoto">ลบรูป</button>` : '<span class="tiny muted">ใส่รูปคู่กับข้อความจะแม่นขึ้น</span>'}
      </div>
      ${ai.busy ? `<button class="btn btn-primary btn-block" disabled>⏳ AI กำลังประเมิน…</button>
        <div class="row between small muted"><span data-ai="busy">0 วิ</span><button class="btn btn-ghost btn-sm" data-ai="cancel">ยกเลิก ใช้ค่าประมาณในเครื่อง</button></div>`
        : `<button class="btn btn-primary btn-block" data-ai="run">🤖 ให้ AI ประเมิน</button>`}
      ${ai.err ? `<div class="alert ${r && r.items.length ? 'warn' : 'danger'}"><span class="ai">⚠️</span><div>${esc(ai.err)}</div></div>` : ''}
      ${r && r.model && r.model !== 'local' ? `<div class="tiny muted">ตอบโดย ${esc(r.model)} · ${r.secs} วิ</div>` : ''}
      ${r ? (r.items.length ? `
        <div class="field-label">ผลประเมิน · แก้ตัวเลขได้ก่อนบันทึก <span class="chip ${r.confidence === 'high' ? 'ok' : r.confidence === 'low' ? 'warn' : ''}">ความมั่นใจ${{ high: 'สูง', medium: 'ปานกลาง', low: 'ต่ำ' }[r.confidence] || ''}</span></div>
        ${r.items.map((it, i) => `<div class="card" style="background:var(--surface-2);box-shadow:none;padding:10px 12px">
          <div class="row"><input type="checkbox" data-ai-on="${i}" ${it.on !== false ? 'checked' : ''} style="accent-color:var(--brand);width:18px;height:18px">
            <input class="input" style="padding:7px 9px;font-size:15px;font-weight:600" value="${esc(it.name)}" data-ai-f="name" data-i="${i}"></div>
          <div class="grid3" style="margin-top:6px">
            <label class="field"><span>kcal</span><input class="input" type="number" inputmode="decimal" style="padding:7px 9px" value="${it.kcal}" data-ai-f="kcal" data-i="${i}"></label>
            <label class="field"><span>โปรตีน g</span><input class="input" type="number" inputmode="decimal" style="padding:7px 9px" value="${it.p}" data-ai-f="p" data-i="${i}"></label>
            <label class="field"><span>ปริมาณ</span><input class="input" style="padding:7px 9px" value="${esc(it.portion)}" data-ai-f="portion" data-i="${i}"></label>
          </div></div>`).join('')}
        ${r.note ? `<div class="alert"><span class="ai">💬</span><div class="small">${esc(r.note)}</div></div>` : ''}
        <div class="center bold" data-ai="total"></div>
        <label class="row small"><input type="checkbox" data-ai="savemm" style="accent-color:var(--brand);width:18px;height:18px"> บันทึกเป็นเมนูของฉันด้วย (ครั้งหน้ากดเพิ่มได้ทันที)</label>
        <button class="btn btn-ok btn-lg btn-block" data-ai="add">เพิ่มลง${MEALS.find(m => m.key === meal).name}</button>
        <p class="tiny muted center">ค่าจาก AI เป็นการประมาณ อาจคลาดเคลื่อนได้</p>`
        : `<div class="alert warn"><span class="ai">🤔</span><div>${esc(r.note || 'AI หาอาหารไม่เจอ ลองพิมพ์ชื่อเมนูให้ชัดขึ้น')}</div></div>`) : ''}
      <button class="btn btn-ghost btn-sm" data-ai="forget" style="align-self:center">เปลี่ยน/ลบ API key</button>
    </div>`;
    updTotal();
  };
  const updTotal = () => {
    const t = pane.querySelector('[data-ai="total"]');
    if (!t || !ai.result) return;
    const on = ai.result.items.filter(x => x.on !== false);
    t.innerHTML = `รวม ${fmt(on.reduce((s, x) => s + (+x.kcal || 0), 0))} kcal · <span style="color:var(--protein)">โปรตีน ${fmt(on.reduce((s, x) => s + (+x.p || 0), 0), 1)} g</span>`;
  };
  pane.oninput = e => {
    const t = e.target;
    if (t.dataset.ai === 'text') ai.text = t.value;
    if (t.dataset.aiF && ai.result) {
      const it = ai.result.items[+t.dataset.i];
      it[t.dataset.aiF] = t.type === 'number' ? +t.value : t.value;
      updTotal();
    }
  };
  pane.onchange = async e => {
    const t = e.target;
    if (t.dataset.aiOn !== undefined && ai.result) { ai.result.items[+t.dataset.aiOn].on = t.checked; updTotal(); }
    if (t.dataset.ai === 'photo' && t.files && t.files[0]) {
      try { ai.image = await imageToBase64(t.files[0]); } catch { toast('อ่านรูปไม่ได้'); }
      draw();
    }
  };
  pane.onclick = async e => {
    const b = e.target.closest('[data-ai]');
    if (!b || b.tagName === 'INPUT' || b.tagName === 'TEXTAREA') return;
    const act = b.dataset.ai;
    if (act === 'savekey') {
      const k = pane.querySelector('[data-ai="keyin"]').value.trim();
      if (k.length < 20) return toast('API key ดูไม่ถูกต้อง');
      b.disabled = true; b.textContent = 'กำลังตรวจสอบ key…';
      try { await testKey(k); await saveAiKey(k); toast('บันทึก key แล้ว ใช้งานได้ ✅'); draw(); }
      catch (err) { toast(err.message || 'ตรวจสอบ key ไม่สำเร็จ', 3500); b.disabled = false; b.textContent = 'บันทึก key'; }
    } else if (act === 'rmphoto') { ai.image = null; draw(); }
    else if (act === 'forget') {
      if (await confirmDialog('ลบ Gemini API key ออกจากเครื่องนี้?', { ok: 'ลบ key', danger: true })) { await clearAiKey(); draw(); }
    } else if (act === 'run') {
      ai.busy = true; ai.err = ''; ai.result = null; ai.status = '';
      ai.ctrl = new AbortController();
      const t0 = Date.now();
      draw();
      const tick = setInterval(() => {
        const b = pane.querySelector('[data-ai="busy"]');
        if (b) b.textContent = `${Math.round((Date.now() - t0) / 1000)} วิ${ai.status ? ' · ' + ai.status : ''}`;
      }, 400);
      try {
        ai.result = await estimateFood({ text: ai.text, image: ai.image, signal: ai.ctrl.signal, onStatus: st => { ai.status = st; } });
      } catch (err) {
        // fallback: on-device estimate from the Thai food list
        const local = ai.text.trim() ? localEstimate(ai.text) : null;
        if (local && local.items.length) {
          ai.result = local;
          ai.err = `${err.message || 'AI ใช้ไม่ได้'} · ใช้ค่าประมาณจากฐานข้อมูลในเครื่องแทน`;
        } else {
          ai.err = `${err.message || 'เกิดข้อผิดพลาด'}${image0(ai) ? ' · รูปอย่างเดียวประเมินในเครื่องไม่ได้ ลองพิมพ์ชื่อเมนู' : ' · ไม่เจอเมนูนี้ในเครื่อง ลองกดอีกครั้ง หรือใช้แท็บกรอกเอง'}`;
          ai.result = null;
        }
      }
      clearInterval(tick);
      ai.busy = false; ai.ctrl = null;
      if (pane.isConnected) draw();
    } else if (act === 'cancel') {
      if (ai.ctrl) ai.ctrl.abort();
    } else if (act === 'add') {
      const on = ai.result.items.filter(x => x.on !== false && x.name);
      if (!on.length) return toast('เลือกอย่างน้อย 1 รายการ');
      const entries = on.map(x => ({ foodId: null, name: x.name, unit: x.portion || '1 ที่', per: 'unit', kcal: +x.kcal || 0, p: +x.p || 0, c: +x.c || 0, f: +x.f || 0, qty: 1, ai: true }));
      addFoods(entries.map(x => ({ ...x, date, meal })));
      if (pane.querySelector('[data-ai="savemm"]').checked) {
        const name = (ai.text.trim() || on.map(x => x.name).join(' + ')).slice(0, 50);
        saveMyMeals([...myMeals(), { id: uid('mm'), name, items: entries }]);
      }
      toast(`เพิ่ม ${on.length} รายการจาก AI แล้ว`);
      closeSheet(); refresh(true);
    }
  };
  draw();
}

function addSheet(meal) {
  ai = { text: '', image: null, result: null, busy: false, err: '' };
  let tab = 'ai';
  const mealName = MEALS.find(m => m.key === meal).name;
  const sh = openSheet({
    title: `เพิ่ม${mealName}`,
    body: `<div class="col">
      <div class="seg"><button class="on" data-tab="ai">🤖 AI</button><button data-tab="mine">เมนูของฉัน</button><button data-tab="manual">กรอกเอง</button></div>
      <div data-pane></div></div>`,
    onMount: el => {
      const pane = el.querySelector('[data-pane]');
      const drawPane = () => {
        el.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
        pane.oninput = pane.onchange = pane.onclick = null;
        if (tab === 'ai') {
          aiPane(pane, meal, () => sh.close());
        } else if (tab === 'mine') {
          const mm = myMeals();
          pane.innerHTML = `${mm.length ? mm.map(m => { const s = sum(m.items); return `<button class="result" data-mm="${m.id}"><div class="grow"><b>${esc(m.name)}</b><small>${m.items.length} อย่าง · ${fmt(s.kcal)} kcal · P ${fmt(s.p, 1)} g</small></div><span class="plus">+</span></button>`; }).join('') : '<div class="empty">ยังไม่มีเมนูของฉัน<br><span class="small">ตอนให้ AI คำนวณ ติ๊ก "บันทึกเป็นเมนูของฉันด้วย" ครั้งหน้ากดเพิ่มได้ทันที ไม่เปลืองโควตา</span></div>'}
            <div class="row" style="margin-top:10px"><button class="btn btn-soft btn-sm" data-act2="newmm">+ สร้างเมนูจาก${mealName}วันนี้</button><button class="btn btn-ghost btn-sm" data-act2="managemm">จัดการ</button></div>`;
        } else {
          pane.innerHTML = `<div class="col">
            <label class="field"><span>ชื่ออาหาร</span><input class="input" data-f="name" placeholder="เช่น ข้าวผัดกะเพราร้านประจำ"></label>
            <div class="grid2"><label class="field"><span>แคลอรี่ (kcal)</span><input class="input" type="number" inputmode="decimal" data-f="kcal"></label>
            <label class="field"><span>โปรตีน (g)</span><input class="input" type="number" inputmode="decimal" data-f="p"></label></div>
            <div class="grid2"><label class="field"><span>คาร์บ (g) ไม่บังคับ</span><input class="input" type="number" inputmode="decimal" data-f="c"></label>
            <label class="field"><span>ไขมัน (g) ไม่บังคับ</span><input class="input" type="number" inputmode="decimal" data-f="f"></label></div>
            <label class="field"><span>ปริมาณ</span><input class="input" data-f="unit" value="1 จาน"></label>
            <label class="row small"><input type="checkbox" data-f="save" style="accent-color:var(--brand);width:18px;height:18px"> บันทึกเป็นเมนูของฉันด้วย</label>
            <button class="btn btn-primary btn-block" data-act2="manualadd">เพิ่ม</button></div>`;
        }
      };
      el.addEventListener('click', ev => {
        const t = ev.target.closest('[data-tab],[data-mm],[data-act2]');
        if (!t) return;
        if (t.dataset.tab) { tab = t.dataset.tab; drawPane(); }
        else if (t.dataset.mm) {
          const m = myMeals().find(x => x.id === t.dataset.mm);
          addFoods(m.items.map(it => ({ ...it, date, meal })));
          toast(`เพิ่ม "${m.name}" แล้ว`);
          sh.close(); refresh(true);
        } else if (t.dataset.act2 === 'newmm') {
          const items = foodOn(date).filter(l => l.meal === meal);
          if (!items.length) return toast(`ยังไม่มีอาหารใน${mealName}วันนี้`);
          const name = prompt('ตั้งชื่อเมนู', items.map(i => i.name).join(' + ').slice(0, 40));
          if (!name) return;
          saveMyMeals([...myMeals(), { id: uid('mm'), name, items: items.map(({ id, date: _d, meal: _m, ...rest }) => rest) }]);
          toast('บันทึกเป็นเมนูของฉันแล้ว'); drawPane();
        } else if (t.dataset.act2 === 'managemm') manageMyMeals(drawPane);
        else if (t.dataset.act2 === 'manualadd') {
          const g = k => el.querySelector(`[data-f="${k}"]`);
          const name = g('name').value.trim(), kcal = +g('kcal').value, p = +g('p').value || 0;
          if (!name || !(kcal >= 0) || g('kcal').value === '') return toast('ใส่ชื่อและแคลอรี่ก่อน');
          const item = { foodId: null, name, unit: g('unit').value.trim() || '1 ที่', per: 'unit', kcal, p, c: +g('c').value || 0, f: +g('f').value || 0, qty: 1 };
          addFood({ ...item, date, meal });
          if (g('save').checked) saveMyMeals([...myMeals(), { id: uid('mm'), name, items: [item] }]);
          toast(`เพิ่ม ${name} แล้ว`);
          sh.close(); refresh(true);
        }
      });
      drawPane();
    },
  });
}

function editSheet(id) {
  const it = foodOn(date).find(l => l.id === id);
  if (!it) return;
  const is100 = it.per === '100g';
  const sh = openSheet({
    title: esc(it.name),
    body: `<div class="col">${stepperHTML(it.qty, { step: is100 ? 10 : 0.5, min: 0, unit: is100 ? 'กรัม' : esc(it.unit) })}
      <div class="card" style="background:var(--surface-2);box-shadow:none;text-align:center" data-preview></div>
      <label class="field"><span>ย้ายไปมื้อ</span><select class="input" data-meal>${MEALS.map(m => `<option value="${m.key}" ${m.key === it.meal ? 'selected' : ''}>${m.name}</option>`).join('')}</select></label>
      <div class="grid2"><button class="btn btn-danger" data-del>ลบ</button><button class="btn btn-primary" data-save>บันทึก</button></div></div>`,
    onMount: el => {
      const prev = el.querySelector('[data-preview]');
      const upd = q => { const v = values({ ...it, qty: q }); prev.innerHTML = `<b style="font-size:20px">${fmt(v.kcal)} kcal</b> · <span style="color:var(--protein);font-weight:700">โปรตีน ${fmt(v.p, 1)} g</span>`; };
      const read = bindStepper(el, upd);
      upd(read());
      el.querySelector('[data-save]').onclick = () => { updateFood(id, { qty: read(), meal: el.querySelector('[data-meal]').value }); sh.close(); refresh(true); };
      el.querySelector('[data-del]').onclick = () => { deleteFood(id); sh.close(); refresh(true); };
    },
  });
}

function manageMyMeals(after) {
  const sh = openSheet({
    title: 'เมนูของฉัน',
    body: `<div class="col">${myMeals().map(m => `<div class="row" style="border-bottom:1px solid var(--line);padding:8px 0"><div class="grow"><b>${esc(m.name)}</b><div class="small muted">${m.items.map(i => `${esc(i.name)} ${esc(qtyLabel(i))}`).join(', ')}</div></div><button class="btn btn-danger btn-sm" data-del="${m.id}">ลบ</button></div>`).join('') || '<div class="empty">ไม่มีเมนู</div>'}</div>`,
    onMount: el => {
      el.addEventListener('click', async e => {
        const d = e.target.closest('[data-del]');
        if (!d) return;
        if (!(await confirmDialog('ลบรายการนี้?', { ok: 'ลบ', danger: true }))) return;
        saveMyMeals(myMeals().filter(m => m.id !== d.dataset.del));
        sh.close(); after && after();
      });
    },
  });
}
