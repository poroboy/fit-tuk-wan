// Generates PNG app icons (no dependencies). Run: node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const SS = 4;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
        r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = a ? r / a : 0; raw[o + 1] = a ? g / a : 0; raw[o + 2] = a ? b / a : 0; raw[o + 3] = (a / (SS * SS)) * 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const box = (px, py, cx, cy, hw, hh, r) => {
  const qx = Math.abs(px - cx) - hw + r, qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
// dumbbell shape in unit space centered at 0.5
function dumbbell(x, y, s) {
  const u = (x - 0.5) / s + 0.5, v = (y - 0.5) / s + 0.5;
  return Math.min(
    box(u, v, 0.5, 0.5, 0.22, 0.045, 0.03),
    box(u, v, 0.27, 0.5, 0.05, 0.2, 0.04), box(u, v, 0.73, 0.5, 0.05, 0.2, 0.04),
    box(u, v, 0.175, 0.5, 0.035, 0.13, 0.03), box(u, v, 0.825, 0.5, 0.035, 0.13, 0.03),
  );
}
const grad = (x, y) => { const t = (x + y) / 2; return [255, 90 + (46 - 90) * t, 54 + (99 - 54) * t]; };

function icon({ maskable = false, scale = 0.78 } = {}) {
  return (x, y) => {
    const bg = maskable ? -1 : box(x, y, 0.5, 0.5, 0.5, 0.5, 0.22);
    if (bg > 0) return [0, 0, 0, 0];
    if (dumbbell(x, y, maskable ? 0.62 : scale) < 0) return [255, 255, 255, 1];
    return [...grad(x, y), 1];
  };
}
const badge = (x, y) => (dumbbell(x, y, 0.95) < 0 ? [255, 255, 255, 1] : [0, 0, 0, 0]);

mkdirSync('icons', { recursive: true });
writeFileSync('icons/icon-192.png', png(192, icon()));
writeFileSync('icons/icon-512.png', png(512, icon()));
writeFileSync('icons/icon-180.png', png(180, icon({ maskable: true, scale: 0.7 })));
writeFileSync('icons/maskable-512.png', png(512, icon({ maskable: true })));
writeFileSync('icons/badge-96.png', png(96, badge));
writeFileSync('icons/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF5A36"/><stop offset="1" stop-color="#FF2E63"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g)"/><g fill="#fff" transform="translate(50 50) scale(.78) translate(-50 -50)"><rect x="28" y="45.5" width="44" height="9" rx="3"/><rect x="22" y="30" width="10" height="40" rx="4"/><rect x="68" y="30" width="10" height="40" rx="4"/><rect x="14" y="37" width="7" height="26" rx="3"/><rect x="79" y="37" width="7" height="26" rx="3"/></g></svg>`);
console.log('icons written');
