// Flat cartoon exercise animations, drawn in code (SVG).
// Each animation: props (static scenery), tempo (rep timing), pose(p) -> draw list.

const NS = 'http://www.w3.org/2000/svg';
const D2R = Math.PI / 180;
const P = (x, y) => ({ x, y });
const pol = (p, deg, len) => P(p.x + Math.cos(deg * D2R) * len, p.y + Math.sin(deg * D2R) * len);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpP = (a, b, t) => P(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
const angOf = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) / D2R;
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const mir = a => 180 - a;
const f1 = n => Math.round(n * 10) / 10;

// 2-bone IK: returns elbow/knee position. bend: +1 clockwise, -1 counter-clockwise (screen space)
function ik(a, b, l1, l2, bend) {
  let d = dist(a, b);
  d = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const base = angOf(a, b);
  const c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const off = Math.acos(Math.max(-1, Math.min(1, c))) / D2R;
  return pol(a, base + bend * off, l1);
}
// circle-circle intersection; side -1/+1 picks which solution
function circX(a, ra, b, rb, side) {
  const d = dist(a, b);
  const dd = Math.min(d, ra + rb - 0.01);
  const x = (ra * ra - rb * rb + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
  return P(a.x + ux * x - side * uy * h, a.y + uy * x + side * ux * h);
}

const C = {
  skin: '#F6C7A1', skinD: '#E2A67E',
  shirt: '#FF6A3D', shirtD: '#D9502A',
  shorts: '#33407A', shortsD: '#242E5C',
  shoe: '#2F3542', shoeD: '#1F232C',
  hair: '#2B2533', eye: '#2B2533', blush: '#FF8A80',
  db: '#454B58', dbD: '#353A45', dbH: '#A9B1BE',
};
const BOARD_COLORS = {
  red: '#E53935', blue: '#1E88E5', yellow: '#FDD835', green: '#43A047',
  orange: '#FB8C00', purple: '#8E24AA', black: '#263238', white: '#ECEFF1',
};
export const BOARD_COLOR_NAMES = {
  red: 'แดง', blue: 'น้ำเงิน', yellow: 'เหลือง', green: 'เขียว', orange: 'ส้ม', purple: 'ม่วง', black: 'ดำ', white: 'ขาว',
};
let boardColors = { chest: 'red', shoulder: 'blue', triceps: 'yellow' };
export function setBoardColors(c) { boardColors = { ...boardColors, ...c }; }
export const boardHex = key => BOARD_COLORS[boardColors[key]] || '#E53935';

// ---------- draw-list primitives ----------
const L = (a, b, w, c) => ({ t: 'l', a, b, w, c });
const O = (p, r, c, o = 1) => ({ t: 'c', p, r, c, o });
const PATH = (d, c) => ({ t: 'p', d, c });
const SPATH = (d, w, c) => ({ t: 's', d, w, c });
const POLY = (pts, c, w) => ({ t: 'g', pts, c, w });

function head(it, c, up, mode = 'side') {
  const r = 10;
  it.push(O(c, r, C.skin));
  const face = up + 90;
  let hc, half;
  if (mode === 'side') { hc = up - 38; half = 82; }
  else if (mode === 'top') { hc = up; half = 112; }
  else { hc = up; half = 68; }
  const rr = r + 0.7;
  const p1 = pol(c, hc - half, rr), p2 = pol(c, hc + half, rr);
  it.push(PATH(`M${f1(p1.x)} ${f1(p1.y)}A${rr} ${rr} 0 ${half * 2 > 180 ? 1 : 0} 1 ${f1(p2.x)} ${f1(p2.y)}Z`, C.hair));
  if (mode === 'side') {
    const e = pol(pol(c, face, 5.4), up, 1.2);
    it.push(O(e, 1.5, C.eye));
    it.push(O(pol(pol(c, face, 3.2), up + 180, 3.6), 2.1, C.blush, 0.55));
  } else if (mode === 'front') {
    const down = up + 180, right = up + 90;
    const base = pol(c, down, 1.2);
    it.push(O(pol(base, right, -3.8), 1.5, C.eye), O(pol(base, right, 3.8), 1.5, C.eye));
    const m1 = pol(pol(c, down, 4.6), right, -2.2), m2 = pol(pol(c, down, 4.6), right, 2.2), mc = pol(c, down, 6.4);
    it.push(SPATH(`M${f1(m1.x)} ${f1(m1.y)}Q${f1(mc.x)} ${f1(mc.y)} ${f1(m2.x)} ${f1(m2.y)}`, 1.3, C.eye));
    it.push(O(pol(pol(c, down, 3.2), right, -6), 1.8, C.blush, 0.5), O(pol(pol(c, down, 3.2), right, 6), 1.8, C.blush, 0.5));
  }
}

function dumbbell(it, c, axis, len, shade) {
  const a = pol(c, axis, -len / 2), b = pol(c, axis, len / 2);
  it.push(L(a, b, 2.6, C.dbH));
  for (const e of [a, b]) it.push(L(pol(e, axis + 90, -5.2), pol(e, axis + 90, 5.2), 4.8, shade ? C.dbD : C.db));
}

function arm(it, sh, el, ha, far, db) {
  it.push(L(sh, el, 8.6, far ? C.skinD : C.skin));
  it.push(L(sh, lerpP(sh, el, 0.42), 10.6, far ? C.shirtD : C.shirt));
  it.push(L(el, ha, 7.6, far ? C.skinD : C.skin));
  if (db) dumbbell(it, db.c || ha, db.axis, db.len, far);
  it.push(O(ha, 4.3, far ? C.skinD : C.skin));
}

function leg(it, hip, kn, an, to, far) {
  it.push(L(hip, kn, 12, far ? C.shortsD : C.shorts));
  it.push(L(kn, an, 9.6, far ? C.skinD : C.skin));
  it.push(L(an, to, 6.6, far ? C.shoeD : C.shoe));
}

// side view body. j = joints
function sideBody(it, j, opts = {}) {
  leg(it, j.hipF || j.hip, j.knF, j.anF, j.toF, true);
  if (!opts.armFront) arm(it, j.shF, j.elF, j.haF, true, j.dbF);
  it.push(L(j.hip, j.neck, 18, C.shirt));
  it.push(L(j.hip, pol(j.hip, angOf(j.hip, j.neck), 4), 18.6, C.shorts));
  it.push(L(j.neck, pol(j.neck, angOf(j.neck, j.head), 5), 7, C.skin));
  head(it, j.head, j.up, 'side');
  leg(it, j.hip, j.knN, j.anN, j.toN, false);
  if (opts.armFront) arm(it, j.shF, j.elF, j.haF, true, j.dbF);
  arm(it, j.shN, j.elN, j.haN, false, j.dbN);
}

function frontBody(it, j, opts = {}) {
  if (!opts.legsAfter) frontLegs(it, j);
  const tl = P(j.shL.x - 1, j.shL.y - 2), tr = P(j.shR.x + 1, j.shR.y - 2);
  const bl = P(j.hipL.x - 3, j.hip.y), br = P(j.hipR.x + 3, j.hip.y);
  it.push(POLY([tl, tr, br, bl], C.shirt, 9));
  it.push(POLY([P(bl.x - 1, j.hip.y - 4), P(br.x + 1, j.hip.y - 4), P(br.x + 1.5, j.hip.y + 6), P(bl.x - 1.5, j.hip.y + 6)], C.shorts, 4));
  it.push(L(j.neck, P(j.neck.x, j.neck.y - 4), 8, C.skin));
  head(it, j.head, j.up, 'front');
  if (opts.legsAfter) frontLegs(it, j);
  arm(it, j.shL, j.elL, j.haL, false, j.dbL);
  arm(it, j.shR, j.elR, j.haR, false, j.dbR);
}
function frontLegs(it, j) {
  for (const s of ['L', 'R']) {
    const hp = j['hip' + s], kn = j['kn' + s], an = j['an' + s];
    it.push(L(hp, kn, 12.5, C.shorts));
    it.push(L(kn, an, 9.8, C.skin));
    const dir = s === 'L' ? -1 : 1;
    it.push(L(P(an.x - 2 * dir, an.y + 2.5), P(an.x + 4 * dir, an.y + 2.5), 6.6, C.shoe));
  }
}

// ---------- tempos ----------
const LIFT = [[1, 1.0, 'ยกขึ้น'], [1, 0.45, 'ค้างไว้'], [0, 2.6, 'ลงช้าๆ 3 วิ'], [0, 0.45, '']];
const PRESS = [[1, 1.0, 'ดันขึ้น'], [1, 0.4, 'ค้างไว้'], [0, 2.6, 'ลงช้าๆ 3 วิ'], [0, 0.45, '']];
const PUSH = [[1, 2.6, 'ลงช้าๆ 3 วิ'], [1, 0.3, ''], [0, 1.0, 'ดันขึ้นเร็ว'], [0, 0.6, '']];
const BREATH = [[1, 2.2, 'เกร็งท้อง หายใจปกติ'], [0, 2.2, 'เกร็งท้อง หายใจปกติ']];
const TWIST = [[1, 0.9, 'บิดตัว'], [1, 0.25, ''], [0, 0.9, 'บิดอีกข้าง'], [0, 0.25, '']];
const CRUNCH = [[1, 1.0, 'ม้วนตัวขึ้น'], [1, 0.6, 'ค้างไว้'], [0, 1.8, 'ลงช้าๆ'], [0, 0.4, '']];
const LEGS = [[1, 1.3, 'ยกขาขึ้น'], [1, 0.3, ''], [0, 2.6, 'ลดขาลงช้าๆ'], [0, 0.4, '']];
const FLY = [[1, 1.2, 'บีบอกยกขึ้น'], [1, 0.4, ''], [0, 2.6, 'กางแขนลงช้าๆ'], [0, 0.6, 'ค้างให้อกยืด']];

const easeIO = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function sample(tempo, t) {
  const total = tempo.reduce((s, x) => s + x[1], 0);
  let x = t % total;
  let prev = tempo[tempo.length - 1][0];
  let lastLabel = '';
  for (const [to, dur, label] of tempo) {
    if (label) lastLabel = label;
    if (x < dur) return { p: lerp(prev, to, easeIO(x / dur)), label: label || '' };
    x -= dur;
    prev = to;
  }
  return { p: prev, label: lastLabel };
}
export const tempoOf = key => (ANIMS[key] ? ANIMS[key].tempo : null);
export const tempoLength = key => (ANIMS[key] ? ANIMS[key].tempo.reduce((s, x) => s + x[1], 0) : 4);

// ---------- scenery ----------
const floor = (extra = '') => `<line class="fig-floor" x1="4" y1="127.5" x2="196" y2="127.5"/>${extra}`;
const shadow = (cx, rx) => `<ellipse class="fig-shadow" cx="${cx}" cy="127.6" rx="${rx}" ry="2.6"/>`;
const mat = (x1, x2) => `<rect class="fig-mat" x="${x1}" y="125" width="${x2 - x1}" height="3.4" rx="1.7"/>`;
function boardSide(hx, colorKey, x1 = hx - 26, x2 = hx + 20) {
  const col = boardHex(colorKey);
  return `<rect class="fig-board" x="${x1}" y="119" width="${x2 - x1}" height="7.4" rx="3"/>` +
    `<rect x="${x1 + 3}" y="120.6" width="${x2 - x1 - 6}" height="2" rx="1" fill="${col}" opacity=".9"/>` +
    `<rect x="${hx - 4.6}" y="113.2" width="9.2" height="6.6" rx="2" fill="#20252E"/>` +
    `<rect x="${hx - 4.6}" y="117.8" width="9.2" height="2" rx="1" fill="${col}"/>`;
}
function boardFront(hx, colorKey) {
  const cols = [['triceps', 11], ['shoulder', 24], ['chest', 36]];
  let holes = '';
  for (const [k, x] of cols) {
    const col = boardHex(k);
    holes += `<circle cx="${100 - x}" cy="121.6" r="2.3" fill="${col}"/><circle cx="${100 + x}" cy="121.6" r="2.3" fill="${col}"/>`;
  }
  const col = boardHex(colorKey);
  const handle = x => `<rect x="${x - 5.5}" y="112.5" width="11" height="7" rx="2.2" fill="#20252E"/><rect x="${x - 5.5}" y="117.8" width="11" height="2.2" rx="1" fill="${col}"/>`;
  return `<rect class="fig-board" x="28" y="118" width="144" height="8" rx="3.5"/>${holes}${handle(100 - hx)}${handle(100 + hx)}`;
}
const bed = () => `<rect class="fig-bed2" x="-4" y="104" width="54" height="23.5" rx="3"/><rect class="fig-bed" x="-4" y="91.5" width="56" height="14" rx="5"/>`;

// ---------- poses ----------
function standSide() {
  const hip = P(96, 70), hipF = P(93, 70);
  const neck = pol(hip, -90, 34), headC = pol(neck, -90, 13);
  const knN = pol(hip, 91, 27), anN = pol(knN, 89, 26), toN = pol(anN, 0, 8);
  const knF = pol(hipF, 89, 27), anF = pol(knF, 91, 26), toF = pol(anF, 0, 8);
  return { hip, hipF, neck, head: headC, up: -90, knN, anN, toN, knF, anF, toF, shN: P(neck.x + 1, neck.y + 4), shF: P(neck.x - 3, neck.y + 4) };
}
function standFront() {
  const hip = P(100, 70), neck = P(100, 36);
  const hipL = P(92, 71), hipR = P(108, 71);
  const knL = pol(hipL, 93, 27), anL = pol(knL, 90, 26);
  const knR = pol(hipR, 87, 27), anR = pol(knR, 90, 26);
  return { hip, neck, head: P(100, 23), up: -90, hipL, hipR, knL, knR, anL, anR, shL: P(85, 40), shR: P(115, 40) };
}

function curlPose(p, hammer) {
  const j = standSide();
  const fa = lerp(84, -64, p);
  j.elN = pol(j.shN, 86, 20); j.haN = pol(j.elN, fa, 18);
  j.elF = pol(j.shF, 88, 20); j.haF = pol(j.elF, fa + 2, 18);
  j.dbN = hammer ? { axis: fa + 90, len: 13 } : { axis: -35, len: 7 };
  j.dbF = hammer ? { axis: fa + 92, len: 13 } : { axis: -35, len: 7 };
  const it = []; sideBody(it, j); return it;
}

function pushupSide(p, elev) {
  const an = elev ? P(37, 88) : P(30, 120.5);
  const hand = elev ? P(121, 115) : P(110, 115);
  const a = lerp(elev ? -7 : -29, elev ? 9 : -12, p);
  const hip = pol(an, a, 53), neck = pol(hip, a, 34), sh = pol(hip, a, 31);
  const headC = pol(neck, a - 4, 13);
  const kn = pol(hip, a + 180, 27);
  const to = P(an.x + 3, an.y + 4.2);
  const haF = P(hand.x - 2.5, hand.y);
  const j = {
    hip, neck, head: headC, up: a - 4,
    knN: kn, anN: an, toN: to, knF: pol(hip, a + 180.6, 27), anF: P(an.x - 1, an.y), toF: P(to.x - 1, to.y),
    shN: sh, haN: hand, elN: ik(sh, hand, 20, 18, 1),
    shF: P(sh.x - 2, sh.y), haF, elF: ik(P(sh.x - 2, sh.y), haF, 20, 18, 1),
  };
  const it = []; sideBody(it, j); return it;
}

function pushupFront(p, wide) {
  const ys = lerp(wide ? 84 : 78, 103, p);
  const shL = P(84, ys), shR = P(116, ys);
  const hx = wide ? 36 : 11;
  const haL = P(100 - hx, 114), haR = P(100 + hx, 114);
  let elL, elR;
  if (wide) { elL = ik(shL, haL, 20, 18, 1); elR = ik(shR, haR, 20, 18, -1); }
  else {
    const k = 0.6 + 3.4 * p;
    elL = P(lerp(shL.x, haL.x, 0.5) - k, lerp(shL.y, haL.y, 0.5));
    elR = P(lerp(shR.x, haR.x, 0.5) + k, lerp(shR.y, haR.y, 0.5));
  }
  const it = [];
  it.push(L(P(90, ys - 3), P(110, ys - 3), 25, C.shirtD));
  it.push(O(shL, 7, C.shirt), O(shR, 7, C.shirt));
  arm(it, shL, elL, haL, false, null);
  arm(it, shR, elR, haR, false, null);
  head(it, P(100, ys + 2), -90, 'top');
  return it;
}

function pikeCalc() {
  const an = P(62, 121), hand = P(118, 115);
  const hipTop = circX(an, 53, hand, 66, -1);
  const shBot = P(121, 97);
  const hipBot = circX(an, 53, shBot, 31, -1);
  return { an, hand, hipTop, hipBot, thTop: angOf(hipTop, hand), thBot: angOf(hipBot, shBot) };
}
let PK = null;
function pikePose(p) {
  PK = PK || pikeCalc();
  const hip = lerpP(PK.hipTop, PK.hipBot, p);
  const th = lerp(PK.thTop, PK.thBot, p);
  const sh = pol(hip, th, 31), neck = pol(hip, th, 34);
  const up = th + lerp(10, 28, p);
  const headC = pol(neck, up, 13);
  const legA = angOf(hip, PK.an);
  const kn = pol(hip, legA, 27);
  const an = pol(kn, legA, 26);
  const to = pol(an, legA - 75, 6);
  const haF = P(PK.hand.x - 2.5, PK.hand.y);
  const shF = P(sh.x - 2, sh.y);
  const j = {
    hip, neck, head: headC, up,
    knN: kn, anN: an, toN: to, knF: pol(hip, legA + 1, 27), anF: pol(pol(hip, legA + 1, 27), legA + 1, 26), toF: P(to.x - 1, to.y),
    shN: sh, haN: PK.hand, elN: ik(sh, PK.hand, 20, 18, 1),
    shF, haF, elF: ik(shF, haF, 20, 18, 1),
  };
  const it = []; sideBody(it, j); return it;
}

function plankPose(p) {
  const an = P(34, 120.5);
  const a = -11.4 + 0.5 * p;
  const hip = pol(an, a, 53), neck = pol(hip, a, 34), sh = pol(hip, a, 31);
  const el = pol(sh, 90, 19), ha = pol(el, 0, 18);
  const to = P(an.x + 3, an.y + 4.2);
  const shF = P(sh.x - 2, sh.y), elF = pol(shF, 90, 19);
  const j = {
    hip, neck, head: pol(neck, a - 3, 13), up: a - 3,
    knN: pol(hip, a + 180, 27), anN: an, toN: to, knF: pol(hip, a + 180.5, 27), anF: P(an.x - 1, an.y), toF: P(to.x - 1, to.y),
    shN: sh, elN: el, haN: ha, shF, elF, haF: pol(elF, 0, 18),
  };
  const it = []; sideBody(it, j); return it;
}

function crunchPose(p) {
  const hip = P(112, 117.5);
  const mid = pol(hip, 180, 14);
  const phi = lerp(180, 214, p);
  const neck = pol(mid, phi, 20), sh = pol(mid, phi, 17);
  const up = phi + 10 * p;
  const headC = pol(neck, up, 13);
  const an = P(152, 121), anF = P(155, 121);
  const knN = ik(hip, an, 27, 26, -1), knF = ik(P(114, 117), anF, 27, 26, -1);
  const aa = lerp(-18, -8, p);
  const elN = pol(sh, aa, 20), haN = pol(elN, aa, 18);
  const shF = P(sh.x + 1, sh.y - 1.5), elF = pol(shF, aa - 2, 20), haF = pol(elF, aa - 2, 18);
  const it = [];
  leg(it, P(114, 117), knF, anF, pol(anF, 0, 7), true);
  arm(it, shF, elF, haF, true, null);
  it.push(L(hip, mid, 18, C.shirt), L(mid, neck, 18, C.shirt));
  it.push(L(hip, pol(hip, 180, 4), 18.6, C.shorts));
  it.push(L(neck, pol(neck, up, 5), 7, C.skin));
  head(it, headC, up, 'side');
  leg(it, hip, knN, an, pol(an, 0, 7), false);
  arm(it, sh, elN, haN, false, null);
  return it;
}

function legRaisePose(p) {
  const hip = P(100, 118.5);
  const neck = pol(hip, 180, 34), sh = pol(hip, 180, 31);
  const headC = pol(neck, 180, 13);
  const la = lerp(-4, -86, p);
  const knN = pol(hip, la, 27), anN = pol(knN, la, 26), toN = pol(anN, la - 90, 7);
  const hipF = P(102, 117.5);
  const knF = pol(hipF, la - 1.5, 27), anF = pol(knF, la - 1.5, 26), toF = pol(anF, la - 91.5, 7);
  const elN = pol(sh, 4, 20), haN = pol(elN, 0, 18);
  const shF = P(sh.x, sh.y - 1.5), elF = pol(shF, 3, 20), haF = pol(elF, 0, 18);
  const it = [];
  leg(it, hipF, knF, anF, toF, true);
  arm(it, shF, elF, haF, true, null);
  it.push(L(hip, neck, 18, C.shirt), L(hip, pol(hip, 180, 4), 18.6, C.shorts));
  it.push(L(neck, pol(neck, 180, 5), 7, C.skin));
  head(it, headC, 180, 'side');
  leg(it, hip, knN, anN, toN, false);
  arm(it, sh, elN, haN, false, null);
  return it;
}

function pressPose(p) {
  const j = standFront();
  const uaL = lerp(165, 252, p), faL = lerp(270, 280, p);
  j.elL = pol(j.shL, uaL, 20); j.haL = pol(j.elL, faL, 18);
  j.elR = pol(j.shR, mir(uaL), 20); j.haR = pol(j.elR, mir(faL), 18);
  j.dbL = { axis: 0, len: 15 }; j.dbR = { axis: 0, len: 15 };
  const it = []; frontBody(it, j); return it;
}
function lateralPose(p) {
  const j = standFront();
  const uaL = lerp(97, 176, p), faL = uaL - lerp(4, 10, p);
  j.elL = pol(j.shL, uaL, 20); j.haL = pol(j.elL, faL, 18);
  j.elR = pol(j.shR, mir(uaL), 20); j.haR = pol(j.elR, mir(faL), 18);
  j.dbL = { axis: -35, len: 7 }; j.dbR = { axis: 215, len: 7 };
  const it = []; frontBody(it, j); return it;
}

function ohTricepsPose(p) {
  const j = standSide();
  const fa = lerp(112, 266, p);
  j.elN = pol(j.shN, -98, 20); j.haN = pol(j.elN, fa, 18);
  j.elF = pol(j.shF, -100, 20); j.haF = pol(j.elF, fa, 18);
  j.dbN = { axis: fa, len: 13, c: pol(j.haN, fa, 4.5) };
  j.dbF = null;
  const it = []; sideBody(it, j, { armFront: true }); return it;
}

function twistPose(p) {
  const s = lerp(-1, 1, p);
  const hip = P(100, 113);
  const neck = P(100 + 4 * s, 84);
  const w = 15 * (1 - 0.22 * Math.abs(s));
  const shL = P(neck.x - w + 2 * s, 88), shR = P(neck.x + w + 2 * s, 88);
  const hipL = P(92, 114), hipR = P(108, 114);
  const knL = P(83, 102), knR = P(117, 102);
  const anL = P(79, 121), anR = P(121, 121);
  const H = P(100 + 27 * s, 97 - 2 * Math.abs(s));
  const haL = P(H.x - 3.5, H.y), haR = P(H.x + 3.5, H.y);
  const j = {
    hip, neck, head: P(100 + 6 * s, 71), up: -90 + 6 * s,
    hipL, hipR, knL, knR, anL, anR, shL, shR,
    haL, haR, elL: ik(shL, haL, 20, 18, 1), elR: ik(shR, haR, 20, 18, -1),
  };
  const it = [];
  frontBody(it, j, { legsAfter: true });
  // one dumbbell held with both hands (drawn over hands)
  dumbbell(it, H, 0, 15, false);
  it.push(O(haL, 4.3, C.skin), O(haR, 4.3, C.skin));
  return it;
}

function flyPose(p) {
  const shL = P(84, 114), shR = P(116, 114);
  const uaL = lerp(150, 280, p), faL = lerp(200, 290, p);
  const elL = pol(shL, uaL, 20), haL = pol(elL, faL, 18);
  const elR = pol(shR, mir(uaL), 20), haR = pol(elR, mir(faL), 18);
  const it = [];
  head(it, P(100, 101), -90, 'front');
  it.push(L(P(85, 116), P(115, 116), 21, C.shirt));
  it.push(O(shL, 6.5, C.shirt), O(shR, 6.5, C.shirt));
  arm(it, shL, elL, haL, false, { axis: -35, len: 7 });
  arm(it, shR, elR, haR, false, { axis: 215, len: 7 });
  // feet toward the viewer
  it.push(L(P(88, 116), P(88, 124), 8.5, C.shoe), L(P(112, 116), P(112, 124), 8.5, C.shoe));
  return it;
}

const LOW = '15 18 170 119';
function rowPose(p) {
  const hip = P(84, 73), hipF = P(81, 73);
  const a = -12;
  const neck = pol(hip, a, 34), sh = pol(hip, a, 31);
  const up = a - 2;
  const headC = pol(neck, up, 13);
  const anN = P(92, 123), anF = P(70, 123);
  const knN = ik(hip, anN, 27, 26, -1), knF = ik(hipF, anF, 27, 26, -1);
  // far hand braced on the bed, near arm rows
  const shF = P(sh.x - 2, sh.y), haF = P(132, 90);
  const ua = lerp(94, 205, p), fa = lerp(90, 96, p);
  const elN = pol(sh, ua, 20), haN = pol(elN, fa, 18);
  const j = {
    hip, hipF, neck, head: headC, up,
    knN, anN, toN: pol(anN, 0, 8), knF, anF, toF: pol(anF, 0, 8),
    shN: sh, elN, haN, shF, haF, elF: ik(shF, haF, 20, 18, -1),
    dbN: { axis: 0, len: 13 },
  };
  const it = []; sideBody(it, j); return it;
}

function reverseFlyPose(p) {
  // bent forward toward the viewer: we see the top of the head and the upper back
  const hipL = P(92, 78), hipR = P(108, 78);
  const knL = pol(hipL, 98, 24), anL = pol(knL, 84, 24);
  const knR = pol(hipR, 82, 24), anR = pol(knR, 96, 24);
  const shL = P(85, 72), shR = P(115, 72);
  const uaL = lerp(94, 170, p), faL = uaL - lerp(6, 10, p);
  const elL = pol(shL, uaL, 20), elR = pol(shR, mir(uaL), 20);
  const it = [];
  frontLegs(it, { hipL, hipR, knL, knR, anL, anR });
  it.push(L(P(94, 76), P(106, 76), 18, C.shorts));            // hips behind
  it.push(L(P(91, 66), P(109, 66), 24, C.shirtD));            // upper back
  it.push(O(shL, 6.8, C.shirt), O(shR, 6.8, C.shirt));
  arm(it, shL, elL, pol(elL, faL, 18), false, { axis: -35, len: 7 });
  arm(it, shR, elR, pol(elR, mir(faL), 18), false, { axis: 215, len: 7 });
  head(it, P(100, 72), -90, 'top');
  return it;
}

function dipPose(p) {
  const drop = lerp(0, 17, p);
  const neck = P(lerp(72, 75, p), 52 + drop), hip = P(lerp(71, 73, p), 86 + drop);
  const sh = P(neck.x + 1, neck.y + 4), shF = P(neck.x - 2, neck.y + 4);
  const haN = P(63, 89), haF = P(60, 89);
  const anN = P(110, 123), anF = P(106, 123);
  const knN = ik(hip, anN, 27, 26, -1), knF = ik(P(hip.x - 2, hip.y), anF, 27, 26, -1);
  const j = {
    hip, hipF: P(hip.x - 2, hip.y), neck, head: pol(neck, -88, 13), up: -88,
    knN, anN, toN: pol(anN, -8, 8), knF, anF, toF: pol(anF, -8, 8),
    shN: sh, haN, elN: ik(sh, haN, 20, 18, 1), shF, haF, elF: ik(shF, haF, 20, 18, 1),
  };
  const it = []; sideBody(it, j); return it;
}

const ROW = [[1, 1.0, 'ดึงศอกขึ้น'], [1, 0.5, 'บีบสะบัก'], [0, 2.6, 'ลงช้าๆ 3 วิ'], [0, 0.45, '']];
const RFLY = [[1, 1.0, 'กางแขนขึ้น'], [1, 0.5, 'บีบสะบัก'], [0, 2.6, 'ลงช้าๆ 3 วิ'], [0, 0.45, '']];
const rowBed = () => `<rect class="fig-bed2" x="122" y="104" width="82" height="23.5" rx="3"/><rect class="fig-bed" x="120" y="91.5" width="84" height="14" rx="5"/>`;
const dipBed = () => `<rect class="fig-bed2" x="-4" y="104" width="68" height="23.5" rx="3"/><rect class="fig-bed" x="-4" y="91.5" width="70" height="14" rx="5"/>`;
const ANIMS = {
  pushup: { vb: LOW, tempo: PUSH, props: () => floor(shadow(70, 46) + boardSide(110, 'chest')), pose: p => pushupSide(p, false) },
  pushup_decline: { vb: LOW, tempo: PUSH, props: () => floor(bed() + shadow(110, 30) + boardSide(121, 'chest')), pose: p => pushupSide(p, true) },
  pushup_wide: { vb: LOW, tempo: PUSH, props: () => floor(shadow(100, 60) + boardFront(36, 'chest')), pose: p => pushupFront(p, true) },
  pushup_narrow: { vb: LOW, tempo: PUSH, props: () => floor(shadow(100, 40) + boardFront(11, 'triceps')), pose: p => pushupFront(p, false) },
  pushup_pike: { vb: LOW, tempo: PUSH, props: () => floor(shadow(90, 40) + boardSide(118, 'shoulder', 96, 124)), pose: pikePose },
  shoulder_press: { tempo: PRESS, props: () => floor(shadow(100, 24)), pose: pressPose },
  curl: { tempo: LIFT, props: () => floor(shadow(98, 20)), pose: p => curlPose(p, false) },
  hammer_curl: { tempo: LIFT, props: () => floor(shadow(98, 20)), pose: p => curlPose(p, true) },
  lateral_raise: { tempo: LIFT, props: () => floor(shadow(100, 24)), pose: lateralPose },
  oh_triceps: { tempo: LIFT, props: () => floor(shadow(98, 20)), pose: ohTricepsPose },
  floor_fly: { vb: LOW, tempo: FLY, props: () => floor(mat(40, 160)), pose: flyPose },
  plank: { vb: LOW, tempo: BREATH, props: () => floor(mat(18, 172)), pose: plankPose },
  crunch: { vb: LOW, tempo: CRUNCH, props: () => floor(mat(30, 170)), pose: crunchPose },
  leg_raise: { vb: LOW, tempo: LEGS, props: () => floor(mat(26, 140)), pose: legRaisePose },
  db_row: { tempo: ROW, props: () => floor(rowBed() + shadow(82, 22)), pose: rowPose },
  reverse_fly: { tempo: RFLY, props: () => floor(shadow(100, 24)), pose: reverseFlyPose },
  bench_dip: { tempo: PUSH, props: () => floor(dipBed() + shadow(95, 26)), pose: dipPose },
  russian_twist: { vb: LOW, tempo: TWIST, props: () => floor(mat(50, 150)), pose: twistPose },
};
export const hasAnim = key => !!ANIMS[key];

// ---------- renderer ----------
const live = new Set();
let running = false;
const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const io = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver(entries => { for (const e of entries) if (e.target._fig) e.target._fig.visible = e.isIntersecting; })
  : null;

export function figHTML(key, { label = false, small = false, view = '' } = {}) {
  return `<div class="fig" data-fig="${key}"${small ? ' data-small="1"' : ''}>${label ? '<span class="fig-label"></span>' : ''}${view ? `<span class="fig-view">${view}</span>` : ''}</div>`;
}

export function mountFigures(root) {
  root.querySelectorAll('[data-fig]:not([data-mounted])').forEach(el => {
    const def = ANIMS[el.dataset.fig];
    if (!def) return;
    el.dataset.mounted = '1';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', def.vb || '0 -8 200 140');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = def.props();
    const g = document.createElementNS(NS, 'g');
    svg.appendChild(g);
    el.prepend(svg);
    const small = !!el.dataset.small;
    const f = { el, g, def, nodes: [], t0: performance.now() - (small ? Math.random() * 2000 : 0), visible: true, small, frame: 0, labelEl: el.querySelector('.fig-label'), lastLabel: null, still: small && reduce };
    el._fig = f;
    if (io) io.observe(el);
    live.add(f);
    draw(f, def.pose(f.still ? 0.55 : 0));
  });
  if (!running && live.size) { running = true; requestAnimationFrame(loop); }
}

export function restartFigure(el) {
  if (el && el._fig) el._fig.t0 = performance.now();
}

function loop(now) {
  for (const f of live) {
    if (!f.el.isConnected) { live.delete(f); if (io) io.unobserve(f.el); continue; }
    if (!f.visible || f.still) continue;
    f.frame++;
    if (f.small && f.frame % 2) continue;
    const { p, label } = sample(f.def.tempo, (now - f.t0) / 1000);
    draw(f, f.def.pose(p));
    if (f.labelEl && label !== f.lastLabel) { f.labelEl.textContent = label; f.lastLabel = label; }
  }
  if (live.size) requestAnimationFrame(loop);
  else running = false;
}

function draw(f, items) {
  if (f.nodes.length !== items.length || f.nodes.some((n, i) => n._t !== items[i].t)) {
    f.g.textContent = '';
    f.nodes = items.map(it => {
      const tag = it.t === 'l' ? 'line' : it.t === 'c' ? 'circle' : 'path';
      const n = document.createElementNS(NS, tag);
      n._t = it.t;
      if (it.t === 'l' || it.t === 's') { n.setAttribute('stroke-linecap', 'round'); }
      if (it.t === 's') { n.setAttribute('fill', 'none'); n.setAttribute('stroke-linecap', 'round'); }
      if (it.t === 'g') n.setAttribute('stroke-linejoin', 'round');
      f.g.appendChild(n);
      return n;
    });
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i], n = f.nodes[i];
    switch (it.t) {
      case 'l':
        n.setAttribute('x1', f1(it.a.x)); n.setAttribute('y1', f1(it.a.y));
        n.setAttribute('x2', f1(it.b.x)); n.setAttribute('y2', f1(it.b.y));
        n.setAttribute('stroke', it.c); n.setAttribute('stroke-width', it.w);
        break;
      case 'c':
        n.setAttribute('cx', f1(it.p.x)); n.setAttribute('cy', f1(it.p.y)); n.setAttribute('r', it.r);
        n.setAttribute('fill', it.c);
        if (it.o !== 1) n.setAttribute('opacity', it.o);
        break;
      case 'p':
        n.setAttribute('d', it.d); n.setAttribute('fill', it.c);
        break;
      case 's':
        n.setAttribute('d', it.d); n.setAttribute('stroke', it.c); n.setAttribute('stroke-width', it.w);
        break;
      case 'g':
        n.setAttribute('d', 'M' + it.pts.map(q => `${f1(q.x)} ${f1(q.y)}`).join('L') + 'Z');
        n.setAttribute('fill', it.c); n.setAttribute('stroke', it.c); n.setAttribute('stroke-width', it.w);
        break;
    }
  }
}

// ---------- board diagram (top view) ----------
export function boardDiagram(active) {
  const cols = [['triceps', 22], ['shoulder', 48], ['chest', 74]];
  let s = '<svg class="board-diagram" viewBox="0 0 240 92" role="img" aria-label="ผังบอร์ดวิดพื้น">';
  s += '<rect x="6" y="18" width="228" height="56" rx="14" class="fig-board"/>';
  for (const [k, x] of cols) {
    const col = boardHex(k);
    for (const side of [-1, 1]) {
      const cx = 120 + side * x;
      for (const dy of [-12, 0, 12]) s += `<circle cx="${cx}" cy="${46 + dy}" r="3.6" fill="${col}"/>`;
      if (k === active) s += `<rect x="${cx - 7}" y="27" width="14" height="38" rx="5" fill="none" stroke="${col}" stroke-width="2.5"/><text x="${cx}" y="12" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor">มือ</text>`;
    }
  }
  s += '<text x="120" y="88" text-anchor="middle" font-size="9.5" fill="currentColor" opacity=".7">ภาพจากด้านบน · ตำแหน่งสีบนบอร์ดจริงอาจต่างกัน</text>';
  return s + '</svg>';
}
