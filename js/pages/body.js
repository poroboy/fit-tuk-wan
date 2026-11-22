import { weightLogs, measureLogs, saveBody, clearBodyField, profile, uid, bodyLogs } from '../data.js';
import { ymd, thaiDate, diffDays, parseYmd } from '../plan.js';
import { photoAll, photoPut, photoDelete } from '../store.js';
import { esc, fmt, openSheet, toast, confirmDialog } from '../ui.js';
import { lineChart } from '../charts.js';
import { movingAvg, bodyInsights, weightTrend } from '../insights.js';
import { weighSheet } from './home.js';
import { refresh } from '../app.js';

export const title = 'ร่างกาย';
export const kicker = () => 'ติดตามการเพิ่มกล้าม';
let range = 90;
let photosCache = null;
let sel = [];

const FIELDS = [
  { k: 'armCm', name: 'รอบแขน (เกร็ง)', ico: '💪' },
  { k: 'chestCm', name: 'รอบอก', ico: '🫁' },
  { k: 'shoulderCm', name: 'รอบไหล่', ico: '🤷' },
  { k: 'waistCm', name: 'รอบเอว', ico: '📏' },
];

function weightCard() {
  const all = weightLogs();
  const today = ymd();
  const w = all.filter(x => diffDays(today, x.date) <= range);
  let chart = '<div class="empty"><span class="e">⚖️</span>ยังไม่มีข้อมูลน้ำหนัก</div>';
  if (w.length) {
    const avg = movingAvg(all).filter(x => diffDays(today, x.date) <= range);
    const x0 = w[0].date;
    const pts = w.map(x => ({ x: diffDays(x.date, x0), y: x.weightKg }));
    const ap = avg.map(x => ({ x: diffDays(x.date, x0), y: x.v }));
    chart = lineChart([{ points: pts, color: 'var(--brand)', dots: true, width: 1.6 }, { points: ap, color: 'var(--protein)', width: 2.8, label: true }],
      { xLabels: [{ x: 0, label: thaiDate(x0, { weekday: false }) }, ...(w.length > 1 ? [{ x: pts[pts.length - 1].x, label: thaiDate(w[w.length - 1].date, { weekday: false }) }] : [])] });
  }
  const tr = weightTrend(all);
  const last = all[all.length - 1];
  return `<div class="card">
    <div class="card-h"><div><h3>น้ำหนักตัว</h3><div class="card-sub">ชั่งสัปดาห์ละ 1–2 ครั้งตอนเช้า</div></div><button class="btn btn-primary btn-sm" data-act="weigh">+ ชั่ง</button></div>
    ${last ? `<div class="row" style="margin-bottom:6px"><div class="big-num">${fmt(last.weightKg, 1)}</div><span class="muted">กก.</span><span class="grow"></span>${tr ? `<span class="chip ${tr.perWeek > 0 ? 'brand' : ''}">${tr.perWeek > 0 ? '+' : ''}${tr.perWeek.toFixed(2)} กก./สัปดาห์</span>` : ''}</div>` : ''}
    ${chart}
    <div class="row between" style="margin-top:6px"><div class="legend"><span><i style="background:var(--brand)"></i>ที่ชั่ง</span><span><i style="background:var(--protein)"></i>เฉลี่ย 7 วัน</span></div>
      <div class="seg seg-sm" style="width:176px">${[30, 90, 365].map(r => `<button class="${range === r ? 'on' : ''}" data-act="range" data-r="${r}">${r === 365 ? '1 ปี' : r + ' วัน'}</button>`).join('')}</div></div>
    ${all.length ? `<details class="more" style="margin-top:10px"><summary>ประวัติน้ำหนัก</summary>${[...all].reverse().slice(0, 30).map(x => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${thaiDate(x.date)}</span><span class="row"><b>${fmt(x.weightKg, 1)} กก.</b><button class="btn btn-ghost btn-sm" data-act="delw" data-d="${x.date}">ลบ</button></span></div>`).join('')}</details>` : ''}
  </div>`;
}

function measureCard() {
  const m = measureLogs();
  const last = m[m.length - 1];
  const first = m[0];
  return `<div class="card">
    <div class="card-h"><div><h3>รอบตัว</h3><div class="card-sub">วัดเดือนละครั้ง (วันที่ 1)</div></div><button class="btn btn-primary btn-sm" data-act="measure">+ วัด</button></div>
    ${last ? `<div class="tiles">${FIELDS.map(f => {
      const v = last[f.k];
      const ref = [...m].reverse().find(x => x !== last && x[f.k] != null);
      const d = v != null && ref ? v - ref[f.k] : null;
      const good = f.k === 'waistCm' ? d <= 0 : d >= 0;
      return `<div class="tile"><small>${f.ico} ${f.name}</small><b>${v != null ? fmt(v, 1) : '–'}</b><span style="color:${d == null ? 'var(--muted)' : good ? 'var(--ok)' : 'var(--warn)'}">${d == null ? 'ซม.' : `${d > 0 ? '+' : ''}${d.toFixed(1)} ซม. จากครั้งก่อน`}</span></div>`;
    }).join('')}</div>
    <div class="small muted" style="margin-top:8px">ล่าสุด ${thaiDate(last.date)}${first && first !== last ? ` · เริ่มวัด ${thaiDate(first.date, { weekday: false })}` : ''}</div>`
      : '<div class="empty"><span class="e">📏</span>ยังไม่ได้วัด วัดครั้งแรกไว้เป็นจุดเริ่มต้น</div>'}
    ${m.length >= 2 ? (() => {
      const x0 = m[0].date;
      const ser = [['armCm', 'var(--m-biceps)'], ['chestCm', 'var(--m-chest)'], ['waistCm', 'var(--warn)']].map(([k, c]) => ({ points: m.filter(x => x[k] != null).map(x => ({ x: diffDays(x.date, x0), y: x[k] - m.find(y => y[k] != null)[k] })), color: c, dots: true, width: 2.4 }));
      return `<div class="field-label" style="margin-top:12px">เปลี่ยนไปจากครั้งแรก (ซม.)</div>${lineChart(ser, { height: 150, yPad: 0.5 })}
        <div class="legend"><span><i style="background:var(--m-biceps)"></i>แขน</span><span><i style="background:var(--m-chest)"></i>อก</span><span><i style="background:var(--warn)"></i>เอว</span></div>`;
    })() : ''}
  </div>`;
}

function photosCard() {
  const ph = photosCache || [];
  return `<div class="card">
    <div class="card-h"><div><h3>รูปก่อน-หลัง</h3><div class="card-sub">ถ่ายเดือนละครั้ง ท่าเดิม แสงเดิม</div></div>
      <label class="btn btn-primary btn-sm" style="cursor:pointer">📷 ถ่าย/เลือกรูป<input type="file" accept="image/*" capture="user" data-photo hidden></label></div>
    ${photosCache === null ? '<div class="empty">กำลังโหลด…</div>' : ph.length ? `
      <div class="photos">${ph.map(p => `<button class="photo ${sel.includes(p.id) ? 'sel' : ''}" data-act="pick" data-id="${p.id}"><img src="${p.dataUrl}" alt="รูปวันที่ ${esc(p.date)}"><span>${thaiDate(p.date, { weekday: false, year: true })}</span></button>`).join('')}</div>
      <p class="small muted" style="margin-top:8px">${ph.length >= 2 ? 'แตะเลือก 2 รูปเพื่อเทียบ หรือ' : ''} แตะรูปค้างไว้เพื่อลบ</p>
      ${ph.length >= 2 ? `<button class="btn btn-soft btn-block" data-act="compare">เทียบรูป ${sel.length === 2 ? '(2 รูปที่เลือก)' : '(แรกสุด vs ล่าสุด)'}</button>` : ''}`
      : '<div class="empty"><span class="e">📸</span>ยังไม่มีรูป ถ่ายรูปแรกไว้เทียบในอีก 1 เดือน</div>'}
    <p class="tiny muted" style="margin-top:8px">🔒 รูปเก็บในเครื่องนี้เท่านั้น ไม่ถูกอัปโหลด</p>
  </div>`;
}

export function render() {
  const ins = bodyInsights(weightLogs(), measureLogs(), profile().goalMode);
  return `<div class="page">
    ${ins.length ? `<div class="col">${ins.map(x => `<div class="alert ${x.kind}"><span class="ai">${x.icon}</span><div>${esc(x.text)}</div></div>`).join('')}</div>` : ''}
    ${weightCard()}
    ${measureCard()}
    ${photosCard()}
  </div>`;
}

export function mount(root) {
  if (photosCache === null) photoAll().then(p => { photosCache = p; refresh(true); });
  root.addEventListener('click', async e => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'weigh') weighSheet(() => refresh(true));
    else if (act === 'range') { range = +a.dataset.r; refresh(true); }
    else if (act === 'delw') { if (await confirmDialog('ลบน้ำหนักวันนี้?', { ok: 'ลบ', danger: true })) { await clearBodyField(a.dataset.d, 'weightKg'); refresh(true); } }
    else if (act === 'measure') measureSheet();
    else if (act === 'pick') {
      const id = a.dataset.id;
      sel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id].slice(-2);
      refresh(true);
    } else if (act === 'compare') compareSheet();
  });
  // long-press to delete photo
  let timer = null;
  root.addEventListener('pointerdown', e => {
    const p = e.target.closest('.photo');
    if (!p) return;
    timer = setTimeout(async () => {
      timer = null;
      if (await confirmDialog('ลบรูปนี้?', { ok: 'ลบ', danger: true })) {
        await photoDelete(p.dataset.id);
        photosCache = await photoAll();
        sel = sel.filter(x => x !== p.dataset.id);
        refresh(true);
      }
    }, 650);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => root.addEventListener(ev, () => { clearTimeout(timer); }));
  const input = root.querySelector('[data-photo]');
  if (input) input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file, 900);
      await photoPut({ id: uid('ph'), date: ymd(), dataUrl });
      photosCache = await photoAll();
      toast('บันทึกรูปแล้ว 📸');
      refresh(true);
    } catch (err) { toast('บันทึกรูปไม่สำเร็จ'); console.error(err); }
  });
}

function resizeImage(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function measureSheet() {
  const m = measureLogs();
  const last = m[m.length - 1] || {};
  const todayRow = bodyLogs().find(l => l.date === ymd()) || {};
  const sh = openSheet({
    title: 'วัดรอบตัว (ซม.)',
    body: `<div class="col">
      <div class="grid2">${FIELDS.map(f => `<label class="field"><span>${f.ico} ${f.name}</span><input class="input" type="number" inputmode="decimal" step="0.1" data-k="${f.k}" value="${todayRow[f.k] ?? ''}" placeholder="${last[f.k] ?? ''}"></label>`).join('')}</div>
      <details class="more"><summary>วิธีวัดให้แม่น</summary><ul>
        <li>แขน: เกร็งหน้าแขน วัดตรงจุดที่ใหญ่สุด</li><li>อก: วัดผ่านหัวนม หายใจปกติ</li>
        <li>เอว: วัดระดับสะดือ ไม่แขม่วท้อง</li><li>ไหล่: วัดรอบไหล่จุดที่กว้างสุด</li><li>วัดเวลาเดิม (เช้า) ก่อนออกกำลังกาย</li></ul></details>
      <button class="btn btn-primary btn-lg btn-block" data-save>บันทึก</button></div>`,
    onMount: el => {
      el.querySelector('[data-save]').onclick = async () => {
        const patch = {};
        el.querySelectorAll('[data-k]').forEach(i => { if (i.value !== '') patch[i.dataset.k] = Math.round(+i.value * 10) / 10; });
        if (!Object.keys(patch).length) return toast('ใส่อย่างน้อย 1 ค่า');
        await saveBody(ymd(), patch);
        toast('บันทึกรอบตัวแล้ว');
        sh.close(); refresh(true);
      };
    },
  });
}

function compareSheet() {
  const ph = photosCache || [];
  let a, b;
  if (sel.length === 2) { [a, b] = sel.map(id => ph.find(p => p.id === id)).sort((x, y) => x.date.localeCompare(y.date)); }
  else { a = ph[0]; b = ph[ph.length - 1]; }
  if (!a || !b) return;
  const days = diffDays(b.date, a.date);
  openSheet({
    title: `เทียบรูป · ห่างกัน ${days} วัน`,
    body: `<div class="col">
      <div class="seg"><button class="on" data-m="slide">เลื่อนเทียบ</button><button data-m="side">วางข้างกัน</button></div>
      <div data-view></div>
      <div class="row between small muted"><span>ก่อน: ${thaiDate(a.date, { year: true })}</span><span>หลัง: ${thaiDate(b.date, { year: true })}</span></div></div>`,
    onMount: el => {
      const view = el.querySelector('[data-view]');
      const draw = mode => {
        el.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x.dataset.m === mode));
        if (mode === 'side') { view.innerHTML = `<div class="side-by-side"><img src="${a.dataUrl}" alt="ก่อน"><img src="${b.dataUrl}" alt="หลัง"></div>`; return; }
        view.innerHTML = `<div class="compare"><img src="${a.dataUrl}" alt="ก่อน"><img class="after" src="${b.dataUrl}" alt="หลัง"><div class="handle"></div><span class="tag" style="left:10px">ก่อน</span><span class="tag" style="right:10px">หลัง</span></div>`;
        const box = view.querySelector('.compare'), after = box.querySelector('.after'), handle = box.querySelector('.handle');
        const setX = clientX => {
          const r = box.getBoundingClientRect();
          const pct = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
          after.style.clipPath = `inset(0 0 0 ${pct}%)`;
          handle.style.left = pct + '%';
        };
        let drag = false;
        box.addEventListener('pointerdown', e => { drag = true; box.setPointerCapture(e.pointerId); setX(e.clientX); });
        box.addEventListener('pointermove', e => { if (drag) setX(e.clientX); });
        box.addEventListener('pointerup', () => { drag = false; });
      };
      el.querySelectorAll('[data-m]').forEach(x => x.onclick = () => draw(x.dataset.m));
      draw('slide');
    },
  });
}
