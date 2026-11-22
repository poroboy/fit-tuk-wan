// First-run setup
import { profile, saveProfile, saveBody, settings } from './data.js';
import { ACTIVITY, GOALS, computeTargets } from './nutrition.js';
import { ymd, thaiDate } from './plan.js';
import { flameSVG, fmt, toast } from './ui.js';
import { figHTML, mountFigures } from './figure.js';
import { requestNotif } from './notify.js';

export function showOnboarding(done) {
  const p = profile();
  const el = document.createElement('div');
  el.className = 'onb';
  el.innerHTML = `<div class="onb-in">
    <div class="onb-hero">${flameSVG(1)}<h1>ฟิตทุกวัน</h1>
      <p class="muted">ตารางเล่นที่ห้อง ดัมเบล 4.5 กก. + บอร์ดวิดพื้น<br>นับแคล นับโปรตีน ติดตามกล้าม แขน · อก · ไหล่ · ท้อง</p></div>
    ${figHTML('pushup', { label: true })}
    <div class="card col">
      <h3>ข้อมูลเพื่อคำนวณแคลและโปรตีน</h3>
      <div class="seg" data-sex><button data-v="male" class="${p.sex === 'male' ? 'on' : ''}">ชาย</button><button data-v="female" class="${p.sex === 'female' ? 'on' : ''}">หญิง</button></div>
      <div class="grid3">
        <label class="field"><span>อายุ</span><input class="input" type="number" inputmode="numeric" data-k="age" value="${p.age}"></label>
        <label class="field"><span>สูง (ซม.)</span><input class="input" type="number" inputmode="decimal" data-k="heightCm" value="${p.heightCm}"></label>
        <label class="field"><span>หนัก (กก.)</span><input class="input" type="number" inputmode="decimal" data-k="weightKg" value="${p.weightKg}"></label>
      </div>
      <div class="field"><span class="field-label">ระดับกิจกรรม</span><div class="choice">${Object.entries(ACTIVITY).map(([k, v]) => `<label><input type="radio" name="act" value="${k}" ${p.activity === k ? 'checked' : ''}><div>${v.name}</div></label>`).join('')}</div></div>
      <div class="field"><span class="field-label">เป้าหมาย</span><div class="choice">${Object.entries(GOALS).map(([k, v]) => `<label><input type="radio" name="goal" value="${k}" ${p.goalMode === k ? 'checked' : ''}><div>${v.name}<small>${v.sub}</small></div></label>`).join('')}</div></div>
      <div class="alert info" data-preview></div>
    </div>
    <div class="alert"><span class="ai">📅</span><div>แผนเริ่ม <b>${thaiDate(settings().startDate)}</b> · เปลี่ยนได้ในตั้งค่า</div></div>
    <button class="btn btn-primary btn-lg btn-block" data-go>เริ่มเลย 🔥</button>
  </div>`;
  document.body.appendChild(el);
  mountFigures(el);
  let sex = p.sex;
  const read = () => ({
    sex,
    age: +el.querySelector('[data-k=age]').value,
    heightCm: +el.querySelector('[data-k=heightCm]').value,
    weightKg: +el.querySelector('[data-k=weightKg]').value,
    activity: el.querySelector('input[name=act]:checked').value,
    goalMode: el.querySelector('input[name=goal]:checked').value,
    proteinPerKg: p.proteinPerKg,
  });
  const preview = () => {
    const v = read();
    if (!(v.age > 0 && v.heightCm > 0 && v.weightKg > 0)) { el.querySelector('[data-preview]').textContent = 'กรอกให้ครบ'; return; }
    const t = computeTargets(v, v.weightKg);
    el.querySelector('[data-preview]').innerHTML = `<span class="ai">🎯</span><div>เป้าวันละ <b>${fmt(t.kcal)} kcal</b> · โปรตีน <b>${t.protein} g</b></div>`;
  };
  el.addEventListener('input', preview);
  el.addEventListener('change', preview);
  el.querySelectorAll('[data-sex] button').forEach(b => b.onclick = () => {
    sex = b.dataset.v;
    el.querySelectorAll('[data-sex] button').forEach(x => x.classList.toggle('on', x === b));
    preview();
  });
  preview();
  el.querySelector('[data-go]').onclick = async () => {
    const v = read();
    if (!(v.age > 0 && v.heightCm > 0 && v.weightKg > 0)) return toast('กรอกอายุ ส่วนสูง น้ำหนักก่อน');
    requestNotif();
    await saveProfile({ ...v, setupDone: true });
    await saveBody(ymd(), { weightKg: v.weightKg });
    el.style.transition = 'opacity .3s'; el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
    done && done();
  };
}
