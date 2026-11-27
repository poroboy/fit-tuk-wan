import { settings, saveSettings, profile, saveProfile, targets } from '../data.js';
import { mondayOf, thaiDate, ymd, dayInfo } from '../plan.js';
import { ACTIVITY, GOALS } from '../nutrition.js';
import { HEALTH_NOTES } from '../exercises.js';
import { BOARD_COLOR_NAMES, setBoardColors } from '../figure.js';
import { esc, fmt, toast, confirmDialog, download } from '../ui.js';
import { exportAll, importAll, clearAll } from '../store.js';
import { notifPermission, requestNotif, showNotif, calendarEvents, gcalLink, icsText, registerPeriodic } from '../notify.js';
import { refresh, applyTheme, checkForUpdate } from '../app.js';
import { APP_VERSION, CHANGELOG } from '../version.js';
import { aiKey, saveAiKey, clearAiKey, testKey, aiModels, aiModel, setAiModel } from '../ai.js';

export const title = 'ตั้งค่า';
export const kicker = () => 'โปรไฟล์ · แผน · แจ้งเตือน';

const tg = (key, on, label, sub = '') => `<div class="setting-row"><div class="grow"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div>
  <label class="toggle"><input type="checkbox" data-s="${key}" ${on ? 'checked' : ''}><i></i></label></div>`;

export function render() {
  const s = settings(), p = profile(), t = targets();
  const perm = notifPermission();
  const info = dayInfo(ymd(), s);
  return `<div class="page">
    <div class="section-title">โปรไฟล์และเป้าหมาย</div>
    <div class="card col">
      <div class="grid2">
        <label class="field"><span>เพศ</span><select class="input" data-p="sex"><option value="male" ${p.sex === 'male' ? 'selected' : ''}>ชาย</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>หญิง</option></select></label>
        <label class="field"><span>อายุ (ปี)</span><input class="input" type="number" inputmode="numeric" data-p="age" value="${p.age}"></label>
        <label class="field"><span>ส่วนสูง (ซม.)</span><input class="input" type="number" inputmode="decimal" data-p="heightCm" value="${p.heightCm}"></label>
        <label class="field"><span>น้ำหนักตั้งต้น (กก.)</span><input class="input" type="number" inputmode="decimal" data-p="weightKg" value="${p.weightKg}"></label>
      </div>
      <label class="field"><span>ระดับกิจกรรม</span><select class="input" data-p="activity">${Object.entries(ACTIVITY).map(([k, v]) => `<option value="${k}" ${p.activity === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label>
      <label class="field"><span>เป้าหมาย</span><select class="input" data-p="goalMode">${Object.entries(GOALS).map(([k, v]) => `<option value="${k}" ${p.goalMode === k ? 'selected' : ''}>${v.name} (${v.sub})</option>`).join('')}</select></label>
      <label class="field"><span>โปรตีน ${p.proteinPerKg.toFixed(1)} g ต่อน้ำหนักตัว 1 กก.</span><input type="range" min="1.6" max="2.2" step="0.1" value="${p.proteinPerKg}" data-p="proteinPerKg"></label>
      <div class="alert info"><span class="ai">🎯</span><div>เป้าวันละ <b>${fmt(t.kcal)} kcal</b> · โปรตีน <b>${t.protein} g</b> · ไขมัน ${t.fat} g · คาร์บ ${t.carb} g<br><span class="small muted">BMR ${fmt(t.bmr)} · TDEE ${fmt(t.tdee)} · ใช้น้ำหนักล่าสุด ${fmt(t.kg, 1)} กก.</span></div></div>
    </div>

    <div class="section-title">แผนออกกำลังกาย</div>
    <div class="card col">
      <label class="field"><span>วันเริ่มแผน (นับสัปดาห์จากวันจันทร์)</span><input class="input" type="date" data-s="startDate" value="${s.startDate}"></label>
      <div class="small muted">${info.prestart ? `เริ่ม ${thaiDate(s.startDate)}` : `ตอนนี้สัปดาห์ที่ ${info.week} · ช่วง ${info.phase.n} ${esc(info.phase.name)}`}${s.weekOffset ? ` · เลื่อนแผนไปแล้ว ${s.weekOffset} สัปดาห์ <button class="btn btn-ghost btn-sm" data-act="resetOffset">รีเซ็ต</button>` : ''}</div>
      <div class="grid2">
        <label class="field"><span>ดัมเบล (กก./ข้าง)</span><input class="input" type="number" inputmode="decimal" step="0.5" data-s="dumbbellKg" value="${s.dumbbellKg}"></label>
        <label class="field"><span>พักระหว่างเซ็ต (วิ)</span><input class="input" type="number" inputmode="numeric" data-s="restSec" value="${s.restSec}"></label>
        <label class="field"><span>พักจบรอบ ชุดรวม (วิ)</span><input class="input" type="number" inputmode="numeric" data-s="roundRestSec" value="${s.roundRestSec}"></label>
        <label class="field"><span>เปลี่ยนท่า ชุดรวม (วิ)</span><input class="input" type="number" inputmode="numeric" data-s="circuitGapSec" value="${s.circuitGapSec}"></label>
      </div>
      ${tg('sound', s.sound, 'เสียงจับเวลา')}
      ${tg('vibrate', s.vibrate, 'สั่นเมื่อครบเวลา')}
      ${tg('voiceCount', s.voiceCount, 'เสียงพูดนับจำนวนครั้ง', 'ตอนกด "นับให้" ในโหมดนำเล่น (ปิดแล้วจะเหลือแค่เสียงบี๊บ)')}
    </div>

    <div class="section-title">บอร์ดวิดพื้น · สีของช่อง</div>
    <div class="card col">
      <p class="small muted">เลือกให้ตรงกับบอร์ดจริง แอนิเมชันและคำแนะนำจะใช้สีนี้</p>
      <div class="grid3">${[['chest', 'อก'], ['shoulder', 'ไหล่'], ['triceps', 'หลังแขน']].map(([k, n]) => `<label class="field"><span>${n}</span><select class="input" data-board="${k}">${Object.entries(BOARD_COLOR_NAMES).map(([c, cn]) => `<option value="${c}" ${s.boardColors[k] === c ? 'selected' : ''}>${cn}</option>`).join('')}</select></label>`).join('')}</div>
    </div>

    <div class="section-title">AI คำนวณแคล (Google Gemini)</div>
    <div class="card col">
      ${aiKey() ? `<div class="alert ok"><span class="ai">🤖</span><div>เชื่อมต่อ Gemini แล้ว · key ลงท้าย <b>…${esc(aiKey().slice(-4))}</b></div></div>
        <label class="field"><span>โมเดล (แนะนำ Flash รุ่นใหม่สุด มีโควตาฟรี)</span><select class="input" data-aimodel>${[...new Set([aiModel(), ...aiModels()].filter(Boolean))].map(m => `<option value="${esc(m)}" ${m === aiModel() ? 'selected' : ''}>${esc(m)}</option>`).join('') || '<option value="">อัตโนมัติ</option>'}</select></label>
        <div class="grid2"><button class="btn btn-soft" data-act="airefresh">ตรวจสอบ/อัปเดตรายชื่อโมเดล</button><button class="btn btn-danger" data-act="aiforget">ลบ key</button></div>`
      : `<p class="small">ใช้ AI คำนวณแคล/โปรตีนจากชื่อเมนูหรือรูปอาหาร ฟรี (มีโควตาต่อวัน) ต้องมี API key ของคุณเอง: เปิด <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color:var(--brand-ink);font-weight:700">aistudio.google.com/apikey</a> → Create API key → คัดลอกมาวาง</p>
        <input class="input" type="password" autocomplete="off" placeholder="วาง Gemini API key" data-aikey>
        <button class="btn btn-primary" data-act="aisave">บันทึกและตรวจสอบ key</button>`}
      <p class="tiny muted">🔒 key เก็บในเครื่องนี้เท่านั้น ไม่อยู่ในไฟล์ Export · ข้อความ/รูปอาหารที่ส่งจะถูกประมวลผลโดย Google (แบบฟรีอาจถูกนำไปปรับปรุงบริการ)</p>
    </div>

    <div class="section-title">การแจ้งเตือน</div>
    <div class="card col">
      <div class="alert ${perm === 'granted' ? 'ok' : 'warn'}"><span class="ai">${perm === 'granted' ? '🔔' : '🔕'}</span><div>
        ${perm === 'granted' ? 'เปิดการแจ้งเตือนแล้ว' : perm === 'denied' ? 'การแจ้งเตือนถูกปิดในเบราว์เซอร์ ไปเปิดที่ ตั้งค่าเว็บไซต์ → การแจ้งเตือน' : perm === 'unsupported' ? 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน' : 'ยังไม่ได้อนุญาตการแจ้งเตือน'}
        ${perm === 'default' ? '<br><button class="btn btn-primary btn-sm" style="margin-top:8px" data-act="perm">อนุญาตการแจ้งเตือน</button>' : ''}
        ${perm === 'granted' ? '<br><button class="btn btn-soft btn-sm" style="margin-top:8px" data-act="test">ทดสอบแจ้งเตือน</button>' : ''}</div></div>
      ${tg('workoutReminder', s.workoutReminder, 'เตือนวันเล่น', 'เฉพาะวันที่มีในตาราง')}
      <label class="field"><span>เวลาเตือนเล่น</span><input class="input" type="time" data-s="reminderTime" value="${s.reminderTime}"></label>
      ${tg('mealReminder', s.mealReminder, 'เตือนบันทึกอาหารหลังมื้อ', 'ถ้ามื้อนั้นยังไม่ได้บันทึก')}
      <div class="grid3">${[['breakfast', 'เช้า'], ['lunch', 'กลางวัน'], ['dinner', 'เย็น']].map(([k, n]) => `<label class="field"><span>${n}</span><input class="input" type="time" data-meal="${k}" value="${s.mealTimes[k]}"></label>`).join('')}</div>
      ${tg('proteinReminder', s.proteinReminder, 'เตือนเมื่อโปรตีน/แคลยังขาด', `ตอน ${s.proteinTime} พร้อมแนะนำเมนูเพิ่ม`)}
      ${tg('weighReminder', s.weighReminder, 'เตือนชั่งน้ำหนัก', 'เช้าวันจันทร์')}
      ${tg('measureReminder', s.measureReminder, 'เตือนวัดรอบตัว + ถ่ายรูป', 'วันที่ 1 ของเดือน')}
      <details class="more"><summary>📅 เตือนแน่นอนแม้ปิดแอป (Google Calendar)</summary>
        <p class="small" style="margin:8px 0">เว็บแอปเตือนได้ตอนเปิดแอปหรือเปิดค้างไว้ และ Chrome อาจปลุกแอปมาเตือนเป็นระยะ ถ้าอยากให้เตือนตรงเวลาทุกครั้ง ให้เพิ่มนัดซ้ำลงปฏิทิน:</p>
        <div class="col">${calendarEvents(s).map(e => `<a class="btn btn-soft btn-block" target="_blank" rel="noopener" href="${gcalLink(e)}">+ ${esc(e.title)}</a>`).join('')}
        <button class="btn btn-ghost" data-act="ics">หรือดาวน์โหลดไฟล์ .ics (ใช้กับปฏิทินอื่น)</button></div></details>
    </div>

    <div class="section-title">หน้าตา</div>
    <div class="card"><div class="seg">${[['auto', 'ตามเครื่อง'], ['light', 'สว่าง'], ['dark', 'มืด']].map(([k, n]) => `<button class="${s.theme === k ? 'on' : ''}" data-theme="${k}">${n}</button>`).join('')}</div></div>

    <div class="section-title">ข้อมูล</div>
    <div class="card col">
      <p class="small muted">ข้อมูลทั้งหมดเก็บในเครื่องนี้ ควรสำรองไว้เป็นระยะ (รวมรูปด้วย)</p>
      <div class="grid2"><button class="btn btn-soft" data-act="export">⬇️ Export JSON</button>
        <label class="btn btn-soft" style="cursor:pointer">⬆️ Import JSON<input type="file" accept="application/json,.json" data-import hidden></label></div>
      <button class="btn btn-danger" data-act="reset">ลบข้อมูลทั้งหมด</button>
    </div>

    <div class="section-title">ข้อควรระวังด้านสุขภาพ</div>
    <div class="card"><ul style="margin:0;padding-left:18px">${HEALTH_NOTES.map(n => `<li style="margin:4px 0">${esc(n)}</li>`).join('')}</ul></div>
    <div class="section-title">เวอร์ชัน</div>
    <div class="card col">
      <div class="row"><div class="grow"><b style="font-size:20px">ฟิตทุกวัน v${APP_VERSION}</b>
        <div class="small muted" data-cachever>กำลังเช็คเวอร์ชันที่ติดตั้ง…</div></div>
        <button class="btn btn-soft btn-sm" data-act="update">🔄 เช็คอัปเดต</button></div>
      <details class="more"><summary>มีอะไรใหม่</summary>${CHANGELOG.map(c => `<div style="margin-top:8px"><b class="small">v${c.v}${c.v === APP_VERSION ? ' (ตอนนี้)' : ''}</b><ul style="margin:2px 0 0">${c.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</details>
    </div>
    <p class="tiny muted center">ฟิตทุกวัน v${APP_VERSION} · ใช้งานออฟไลน์ได้ · ไม่มีการเก็บข้อมูลขึ้นเซิร์ฟเวอร์</p>
  </div>`;
}

async function showCacheVersion(root) {
  const el = root.querySelector('[data-cachever]');
  if (!el) return;
  try {
    const keys = (await caches.keys()).filter(k => k.startsWith('fit-v'));
    const installed = keys.length ? keys.sort().pop().replace('fit-v', '') : null;
    el.textContent = !installed ? 'ใช้งานแบบออนไลน์ (ยังไม่ได้แคชไว้ใช้ออฟไลน์)'
      : installed === APP_VERSION ? `ติดตั้งแล้ว ใช้ออฟไลน์ได้ ✓ (v${installed})`
        : `ไฟล์ออฟไลน์ยังเป็น v${installed} ปิดแล้วเปิดแอปใหม่อีกครั้ง`;
  } catch { el.textContent = ''; }
}

export function mount(root) {
  showCacheVersion(root);
  // the offline copy may still be installing — check again once it settles
  if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(() => setTimeout(() => showCacheVersion(root), 1500));
  setTimeout(() => showCacheVersion(root), 4000);
  root.addEventListener('change', async e => {
    const el = e.target;
    if (el.dataset.p) {
      const k = el.dataset.p;
      const v = ['sex', 'activity', 'goalMode'].includes(k) ? el.value : +el.value;
      if (typeof v === 'number' && !(v > 0)) return toast('ค่าไม่ถูกต้อง');
      await saveProfile({ [k]: v });
      refresh(true);
    } else if (el.dataset.s) {
      const k = el.dataset.s;
      let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value;
      if (k === 'startDate') {
        if (!v) return;
        v = mondayOf(v);
        await saveSettings({ startDate: v, weekOffset: 0 });
        toast(`ตั้งวันเริ่มเป็น ${thaiDate(v)}`);
        return refresh(true);
      }
      if (el.type === 'number' && !(v > 0)) return toast('ค่าไม่ถูกต้อง');
      await saveSettings({ [k]: v });
      if (el.type === 'checkbox' && v && k.endsWith('Reminder') && notifPermission() === 'default') requestNotif().then(() => refresh(true));
      refresh(true);
    } else if (el.dataset.meal) {
      await saveSettings({ mealTimes: { ...settings().mealTimes, [el.dataset.meal]: el.value } });
    } else if (el.dataset.aimodel !== undefined) {
      await setAiModel(el.value);
      toast(`ใช้โมเดล ${el.value}`);
    } else if (el.dataset.board) {
      const bc = { ...settings().boardColors, [el.dataset.board]: el.value };
      await saveSettings({ boardColors: bc });
      setBoardColors(bc);
      toast('เปลี่ยนสีบอร์ดแล้ว');
    } else if (el.dataset.import !== undefined && el.files && el.files[0]) {
      try {
        const data = JSON.parse(await el.files[0].text());
        if (!(await confirmDialog('นำเข้าข้อมูลนี้? ข้อมูลปัจจุบันในเครื่องจะถูกแทนที่ทั้งหมด', { ok: 'นำเข้า', danger: true }))) return;
        await importAll(data);
        toast('นำเข้าข้อมูลแล้ว');
        setTimeout(() => location.reload(), 600);
      } catch (err) { toast('นำเข้าไม่สำเร็จ: ' + err.message); }
    }
  });
  root.addEventListener('click', async e => {
    const t = e.target.closest('[data-act],[data-theme]');
    if (!t) return;
    if (t.dataset.theme) { await saveSettings({ theme: t.dataset.theme }); applyTheme(); refresh(true); return; }
    const act = t.dataset.act;
    if (act === 'perm') { const r = await requestNotif(); toast(r === 'granted' ? 'เปิดการแจ้งเตือนแล้ว 🔔' : 'ไม่ได้รับอนุญาต'); refresh(true); }
    else if (act === 'test') { const ok = await showNotif('ทดสอบแจ้งเตือน 🔥', 'ถ้าเห็นข้อความนี้ แปลว่าแจ้งเตือนใช้งานได้', { tag: 'test' }); if (!ok) toast('แสดงแจ้งเตือนไม่ได้'); registerPeriodic(); }
    else if (act === 'ics') download('fit-tuk-wan-reminders.ics', icsText(calendarEvents()), 'text/calendar');
    else if (act === 'aisave' || act === 'airefresh') {
      const k = act === 'aisave' ? (root.querySelector('[data-aikey]').value || '').trim() : aiKey();
      if (k.length < 20) return toast('API key ดูไม่ถูกต้อง');
      t.disabled = true; t.textContent = 'กำลังตรวจสอบ…';
      try {
        const models = await testKey(k);
        if (act === 'aisave') await saveAiKey(k);
        toast(models.length ? `ใช้ได้ ✅ เลือก ${models[0]} ให้อัตโนมัติ` : 'key ใช้ได้ แต่ไม่พบโมเดล Flash จะใช้ค่าเริ่มต้น', 3500);
      } catch (err) { toast(err.message || 'ตรวจสอบไม่สำเร็จ', 3500); }
      refresh(true);
    } else if (act === 'aiforget') {
      if (await confirmDialog('ลบ Gemini API key ออกจากเครื่องนี้?', { ok: 'ลบ key', danger: true })) { await clearAiKey(); refresh(true); }
    }
    else if (act === 'update') {
      t.disabled = true; t.textContent = 'กำลังเช็ค…';
      const r = await checkForUpdate();
      toast(r === 'updating' ? 'พบเวอร์ชันใหม่ กำลังโหลด แอปจะรีเฟรชเอง…' : r === 'offline' ? 'ไม่ได้ต่อเน็ต เช็คอัปเดตไม่ได้' : `เป็นเวอร์ชันล่าสุดแล้ว (v${APP_VERSION}) ✅`, 3500);
      t.disabled = false; t.textContent = '🔄 เช็คอัปเดต';
    }
    else if (act === 'resetOffset') { await saveSettings({ weekOffset: 0 }); refresh(true); }
    else if (act === 'export') {
      const data = await exportAll();
      download(`fit-tuk-wan-backup-${ymd()}.json`, JSON.stringify(data));
      toast('ดาวน์โหลดไฟล์สำรองแล้ว');
    } else if (act === 'reset') {
      if (!(await confirmDialog('ลบข้อมูลทั้งหมดในเครื่องนี้? กู้คืนไม่ได้ถ้าไม่ได้ Export ไว้', { ok: 'ลบทั้งหมด', danger: true }))) return;
      if (!(await confirmDialog('แน่ใจนะ? ประวัติการเล่น อาหาร น้ำหนัก และรูปจะหายหมด', { ok: 'ยืนยันลบ', danger: true }))) return;
      await clearAll();
      location.reload();
    }
  });
}
