// AI food estimate via Google Gemini API (user's own key, stored only on this device)
import { get, set } from './store.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
// fallbacks if the model list can't be read
const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];

// Pick the newest "Flash" model the key can use (Flash = fast, cheap, has a free tier)
export function rankFlashModels(names) {
  const ver = n => { const m = n.match(/^gemini-(\d+(?:\.\d+)?)-flash/); return m ? parseFloat(m[1]) : -1; };
  return names
    .filter(n => /^gemini-\d+(\.\d+)?-flash(-preview)?(-\d{2}-\d{4}|-\d{3})?$/.test(n))
    .sort((a, b) => ver(b) - ver(a) || (a.includes('preview') ? 1 : 0) - (b.includes('preview') ? 1 : 0) || a.length - b.length);
}
export async function listModels(key) {
  const out = [];
  let page = '';
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${ENDPOINT}?pageSize=200${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`, { headers: { 'x-goog-api-key': key.trim() } });
    let body = null;
    try { body = await res.json(); } catch { /* ignore */ }
    if (!res.ok) throw new AiError(errorFor(res.status, body));
    for (const m of body.models || []) {
      if ((m.supportedGenerationMethods || []).includes('generateContent')) out.push(String(m.name).replace(/^models\//, ''));
    }
    page = body.nextPageToken;
    if (!page) break;
  }
  return out;
}

export const aiKey = () => (get('secrets', {}).geminiKey || '');
export const aiModel = () => (get('secrets', {}).geminiModel || '');
export const saveAiKey = key => set('secrets', { ...get('secrets', {}), geminiKey: key.trim() });
export const clearAiKey = () => set('secrets', {});

const PROMPT = `คุณคือนักโภชนาการที่เชี่ยวชาญอาหารไทย ช่วยประเมินพลังงานและสารอาหารของสิ่งที่ผู้ใช้กินในมื้อนี้
- แยกเป็นรายการอาหาร/เครื่องดื่มแต่ละอย่าง ตั้งชื่อเป็นภาษาไทยสั้นๆ
- ใช้ขนาดเสิร์ฟทั่วไปในไทย (ร้านตามสั่ง ร้านข้าวแกง 7-Eleven) ถ้าไม่ได้ระบุปริมาณ
- ตัวเลขเป็นค่ารวมของปริมาณที่กินจริงของรายการนั้น (ไม่ใช่ต่อ 100 g)
- คิดน้ำมันที่ใช้ปรุงรวมไปในรายการด้วย
- portion บอกปริมาณสั้นๆ เช่น "1 จาน", "2 ฟอง", "1 แก้ว (ไม่หวาน)"
- note: สมมติฐานที่ใช้ หรือคำแนะนำสั้นๆ 1 ประโยค ภาษาไทย
- ถ้ารูป/ข้อความไม่ใช่อาหาร ให้ items เป็นอาร์เรย์ว่าง และอธิบายใน note`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          portion: { type: 'STRING' },
          kcal: { type: 'NUMBER' },
          protein_g: { type: 'NUMBER' },
          carb_g: { type: 'NUMBER' },
          fat_g: { type: 'NUMBER' },
        },
        required: ['name', 'portion', 'kcal', 'protein_g', 'carb_g', 'fat_g'],
      },
    },
    note: { type: 'STRING' },
    confidence: { type: 'STRING', enum: ['low', 'medium', 'high'] },
  },
  required: ['items', 'note', 'confidence'],
};

export class AiError extends Error {}

// Gemini 2.5/3 "think" before answering by default, which is slow. Food estimates don't need it.
function thinkingFor(model) {
  if (/^gemini-[3-9]/.test(model)) return { thinkingLevel: 'low' };
  if (/^gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  return null;
}

async function call(model, key, parts, { signal, thinking = true } = {}) {
  const generationConfig = { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2 };
  const th = thinking ? thinkingFor(model) : null;
  if (th) generationConfig.thinkingConfig = th;
  return fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }),
    signal,
  });
}

function errorFor(status, body) {
  const msg = (body && body.error && body.error.message) || '';
  if (status === 400 && /API key/i.test(msg)) return 'API key ไม่ถูกต้อง ลองคัดลอกใหม่จาก Google AI Studio';
  if (status === 401 || status === 403) return 'API key ใช้ไม่ได้ หรือยังไม่ได้เปิดใช้ Gemini API';
  if (status === 429) return 'ใช้เกินโควตาฟรีแล้ว รอสักครู่หรือพรุ่งนี้แล้วลองใหม่';
  if (status >= 500) return 'เซิร์ฟเวอร์ Gemini มีปัญหาชั่วคราว ลองใหม่อีกครั้ง';
  return `เรียก AI ไม่สำเร็จ (${status}) ${msg.slice(0, 120)}`;
}

const MAIN_TIMEOUT = 12000;   // per model
const TOTAL_TIMEOUT = 30000;  // then give up -> app uses the on-device estimate
const LITE = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];

// text: description, image: { mime, base64 } (optional)
// onStatus(text) reports progress; signal lets the user cancel
export async function estimateFood({ text = '', image = null, signal = null, onStatus = () => {} }) {
  const key = aiKey();
  if (!key) throw new AiError('ยังไม่ได้ใส่ Gemini API key');
  if (!navigator.onLine) throw new AiError('ไม่ได้ต่ออินเทอร์เน็ต');
  const parts = [{ text: PROMPT }];
  if (text.trim()) parts.push({ text: `สิ่งที่กิน: ${text.trim()}` });
  if (image) parts.push({ inline_data: { mime_type: image.mime, data: image.base64 } });
  if (parts.length === 1) throw new AiError('พิมพ์ชื่อเมนูหรือใส่รูปก่อน');

  const main = [...new Set([aiModel(), ...aiModels().slice(0, 3), ...MODELS].filter(Boolean))];
  const lite = [...new Set([...aiLiteModels(), ...LITE])].filter(m => !main.includes(m));
  const started = Date.now();
  let lastErr = null, timedOut = false;
  const queue = [...main.map(m => ({ m, lite: false })), ...lite.map(m => ({ m, lite: true }))];

  for (let i = 0; i < queue.length; i++) {
    const { m: model, lite: isLite } = queue[i];
    // a slow model is usually slow for every big model -> after a timeout jump straight to the Lite models
    if (timedOut && !isLite) continue;
    const left = TOTAL_TIMEOUT - (Date.now() - started);
    if (left < 2500) break;
    if (signal && signal.aborted) throw new AiError('ยกเลิกแล้ว');
    onStatus(`${isLite ? 'สลับไปรุ่นเร็ว ' : ''}${model}`);

    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    if (signal) signal.addEventListener('abort', onAbort);
    const timer = setTimeout(() => ctrl.abort(), Math.min(MAIN_TIMEOUT, left));
    let res, body = null;
    try {
      res = await call(model, key, parts, { signal: ctrl.signal });
      try { body = await res.json(); } catch { /* ignore */ }
      // the model rejected the thinking setting -> retry once without it
      if (res.status === 400 && /thinking/i.test(JSON.stringify(body || ''))) {
        res = await call(model, key, parts, { signal: ctrl.signal, thinking: false });
        body = null;
        try { body = await res.json(); } catch { /* ignore */ }
      }
    } catch (err) {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      if (signal && signal.aborted) throw new AiError('ยกเลิกแล้ว');
      if (err && err.name === 'AbortError') { timedOut = true; lastErr = `${model} ช้าเกินไป`; continue; }
      throw new AiError('เชื่อมต่อ Gemini ไม่ได้ ตรวจสอบอินเทอร์เน็ต');
    }
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);

    if (res.status === 404) { lastErr = 'ไม่พบโมเดล'; continue; }
    if (res.status === 429 && /limit: ?0\b/.test(JSON.stringify(body || ''))) { lastErr = `${model} ไม่มีโควตาฟรี`; continue; }
    if (res.status === 429 || res.status >= 500) { lastErr = errorFor(res.status, body); continue; }
    if (!res.ok) throw new AiError(errorFor(res.status, body));
    // remember the model that answered so next time starts with it
    if (model !== aiModel()) set('secrets', { ...get('secrets', {}), geminiModel: model });
    const txt = body && body.candidates && body.candidates[0] && body.candidates[0].content
      && (body.candidates[0].content.parts || []).map(p => p.text || '').join('');
    if (!txt) { lastErr = 'AI ไม่ได้ตอบกลับ'; continue; }
    let data;
    try { data = JSON.parse(txt.replace(/^```(json)?|```$/g, '').trim()); }
    catch { lastErr = 'อ่านคำตอบจาก AI ไม่ได้'; continue; }
    const items = (data.items || []).map(it => ({
      name: String(it.name || 'อาหาร').slice(0, 60),
      portion: String(it.portion || '1 ที่').slice(0, 40),
      kcal: Math.max(0, Math.round(+it.kcal || 0)),
      p: Math.max(0, Math.round((+it.protein_g || 0) * 10) / 10),
      c: Math.max(0, Math.round((+it.carb_g || 0) * 10) / 10),
      f: Math.max(0, Math.round((+it.fat_g || 0) * 10) / 10),
    }));
    return { items, note: String(data.note || ''), confidence: data.confidence || 'medium', model, secs: Math.round((Date.now() - started) / 100) / 10 };
  }
  throw new AiError(timedOut ? 'AI ตอบช้าเกินไป' : `ใช้ AI ไม่ได้ (${lastErr || 'ไม่ทราบสาเหตุ'})`);
}

// check the key and remember which Flash models it can use
export async function testKey(key) {
  const all = await listModels(key);
  const flash = rankFlashModels(all);
  const lite = rankFlashModels(all.map(n => n.replace('-flash-lite', '-flash')).filter((n, i) => all[i].includes('-flash-lite')))
    .map(n => n.replace('-flash', '-flash-lite'));
  set('secrets', { ...get('secrets', {}), geminiModels: flash, geminiLite: lite, geminiModel: flash[0] || '' });
  return flash;
}
export const aiModels = () => (get('secrets', {}).geminiModels || []);
export const aiLiteModels = () => (get('secrets', {}).geminiLite || []);
export const setAiModel = m => set('secrets', { ...get('secrets', {}), geminiModel: m });

export function imageToBase64(file, max = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const dataUrl = c.toDataURL('image/jpeg', 0.8);
      resolve({ mime: 'image/jpeg', base64: dataUrl.split(',')[1], dataUrl });
    };
    img.onerror = reject;
    img.src = url;
  });
}
